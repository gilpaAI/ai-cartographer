import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { loadConfig, resolveOutputPath, resolveCachePath } from "../config.js";
import { discoverFiles } from "../discovery.js";
import { classifyFiles, getTierSummary, estimateCost } from "../classifier.js";
import { saveHashCache, hashFileContent, type HashCache } from "../hasher.js";
import { createProvider, analyzeFiles } from "../llm/client.js";
import { generateMap } from "../generator.js";
import { generateFreeDescriptions } from "../free.js";

interface InitOptions {
  verbose: boolean;
  free: boolean;
  dryRun: boolean;
  output?: string;
}

export async function initCommand(
  projectRoot: string,
  options: InitOptions
): Promise<void> {
  const config = await loadConfig(projectRoot);
  if (options.output) config.outputPath = options.output;

  const spinner = ora("Discovering files...").start();

  // Step 1: Discover files
  const files = await discoverFiles(projectRoot, config);
  spinner.succeed(`Found ${files.length} files`);

  // Step 2: Classify into tiers
  spinner.start("Classifying files...");
  const classified = classifyFiles(files, config);
  const summary = getTierSummary(classified);
  spinner.succeed(
    `Classified: ${summary.autoSkip} auto-skip, ${summary.batch} batch, ${summary.deep} deep`
  );

  // Dry run: show estimates and exit
  if (options.dryRun) {
    const cost = estimateCost(classified, config.tiers.batchSize);
    console.log("\n📊 Dry Run Summary:");
    console.log(`   Total files: ${summary.total}`);
    console.log(`   Auto-skip:   ${summary.autoSkip} (no API calls)`);
    console.log(`   Batch tier:  ${summary.batch} → ${cost.batchCalls} API calls`);
    console.log(`   Deep tier:   ${summary.deep} → ${cost.deepCalls} API calls`);
    console.log(`   Est. cost:   ${cost.estimatedCost}`);
    return;
  }

  // Step 3: Generate descriptions
  let descriptions: Map<string, string>;
  let pending: string[] = [];

  if (options.free) {
    spinner.start("Generating descriptions (free mode)...");
    descriptions = generateFreeDescriptions(files);
    spinner.succeed("Descriptions generated (free mode — no API calls)");
  } else {
    // LLM analysis
    const provider = createProvider(config);
    spinner.start(`Analyzing ${summary.batch + summary.deep} files via LLM...`);

    const result = await analyzeFiles(
      projectRoot,
      classified,
      provider,
      config,
      (completed, total) => {
        spinner.text = `Analyzing files... ${completed}/${total}`;
      }
    );

    descriptions = result.descriptions;
    pending = result.pending;

    if (pending.length > 0) {
      spinner.warn(
        `Analyzed ${descriptions.size} files (${pending.length} pending — API errors)`
      );
    } else {
      spinner.succeed(`Analyzed ${descriptions.size} files`);
    }
  }

  // Step 4: Generate map
  spinner.start("Generating context map...");
  const repoName = path.basename(projectRoot);
  const mapContent = generateMap(descriptions, repoName, pending);

  // Ensure output directory exists
  const outputPath = resolveOutputPath(projectRoot, config);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, mapContent);
  spinner.succeed(`Context map written to ${config.outputPath}`);

  // Step 5: Save hash cache
  spinner.start("Saving cache...");
  const cache: HashCache = {};
  for (const file of classified) {
    const fullPath = path.join(projectRoot, file.relativePath);
    try {
      cache[file.relativePath] = {
        hash: hashFileContent(fullPath),
        tier: file.tier,
        description: descriptions.get(file.relativePath),
        lastAnalyzed: new Date().toISOString(),
      };
    } catch {
      // Skip files that can't be hashed
    }
  }
  saveHashCache(projectRoot, cache);
  spinner.succeed("Cache saved");

  // Step 6: Ensure .ai/.cache/ is gitignored
  ensureCacheIgnored(projectRoot);

  // Summary
  const tokenEstimate = Math.ceil(mapContent.length / 4);
  console.log(`\n✅ Context map ready!`);
  console.log(`   📄 ${config.outputPath} (${descriptions.size} files, ~${tokenEstimate} tokens)`);
  if (pending.length > 0) {
    console.log(`   ⚠️  ${pending.length} files pending — run 'ai-cartographer refresh' to retry`);
  }
}

function ensureCacheIgnored(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, ".gitignore");

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (content.includes(".ai/.cache")) return;
    fs.appendFileSync(gitignorePath, "\n.ai/.cache/\n");
  } else {
    fs.writeFileSync(gitignorePath, ".ai/.cache/\n");
  }
}
