import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { loadConfig, resolveOutputPath } from "../config.js";
import { discoverFiles } from "../discovery.js";
import { classifyFiles } from "../classifier.js";
import {
  loadHashCache,
  saveHashCache,
  computeHashDiff,
  hashFileContent,
  type HashCache,
} from "../hasher.js";
import { createProvider, analyzeFiles } from "../llm/client.js";
import { generateMap } from "../generator.js";
import type { ClassifiedFile } from "../classifier.js";

interface RefreshOptions {
  verbose: boolean;
  free: boolean;
  quiet: boolean;
}

export async function refreshCommand(
  projectRoot: string,
  options: RefreshOptions
): Promise<void> {
  const config = await loadConfig(projectRoot);
  const spin = (msg: string) =>
    options.quiet ? { succeed: () => {}, warn: () => {}, start: () => {}, text: "" } as any : ora(msg).start();

  // Load existing cache
  const cache = loadHashCache(projectRoot);
  const hasCachedData = Object.keys(cache).length > 0;

  if (!hasCachedData) {
    if (!options.quiet) {
      console.log("No cache found — running full scan...");
    }
    // Import and run init instead
    const { initCommand } = await import("./init.js");
    return initCommand(projectRoot, { verbose: options.verbose, free: options.free, dryRun: false });
  }

  // Discover current files
  const spinner = spin("Scanning for changes...");
  const files = await discoverFiles(projectRoot, config);
  const filePaths = files.map((f) => f.relativePath);

  // Compute diff
  const diff = computeHashDiff(projectRoot, filePaths, cache);
  const changedCount = diff.added.length + diff.changed.length + diff.removed.length;

  if (changedCount === 0) {
    spinner.succeed("No changes detected — map is up to date");
    return;
  }

  spinner.succeed(
    `Changes: ${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed (${diff.unchanged.length} unchanged)`
  );

  // Classify only changed/added files
  const changedFiles = files.filter(
    (f) => diff.added.includes(f.relativePath) || diff.changed.includes(f.relativePath)
  );
  const classified = classifyFiles(changedFiles, config);

  // Analyze changed files
  const descriptions = new Map<string, string>();
  let pending: string[] = [];

  // Carry over cached descriptions for unchanged files
  for (const filePath of diff.unchanged) {
    const cached = cache[filePath];
    if (cached?.description) {
      descriptions.set(filePath, cached.description);
    }
  }

  // Analyze new/changed files
  if (options.free) {
    const { generateFreeDescriptions } = await import("../free.js");
    const freeDescs = generateFreeDescriptions(changedFiles);
    for (const [p, d] of freeDescs) descriptions.set(p, d);
  } else {
    const needsLLM = classified.filter((f) => f.tier !== "auto-skip");
    const autoSkipped = classified.filter((f) => f.tier === "auto-skip");

    for (const f of autoSkipped) {
      descriptions.set(f.relativePath, f.autoDescription ?? "Configuration file");
    }

    if (needsLLM.length > 0) {
      const analyzeSpinner = spin(`Analyzing ${needsLLM.length} changed files...`);
      const provider = createProvider(config);
      const result = await analyzeFiles(
        projectRoot,
        classified,
        provider,
        config,
        (completed, total) => {
          analyzeSpinner.text = `Analyzing... ${completed}/${total}`;
        }
      );

      for (const [p, d] of result.descriptions) descriptions.set(p, d);
      pending = result.pending;
      analyzeSpinner.succeed(`Analyzed ${result.descriptions.size} files`);
    }
  }

  // Remove deleted files (don't add them to descriptions)
  // They're simply not in the map anymore

  // Regenerate map
  const genSpinner = spin("Regenerating context map...");
  const repoName = path.basename(projectRoot);
  const mapContent = generateMap(descriptions, repoName, pending);
  const outputPath = resolveOutputPath(projectRoot, config);
  fs.writeFileSync(outputPath, mapContent);
  genSpinner.succeed("Context map updated");

  // Update cache
  const newCache: HashCache = {};
  for (const filePath of filePaths) {
    const fullPath = path.join(projectRoot, filePath);
    try {
      newCache[filePath] = {
        hash: hashFileContent(fullPath),
        tier: cache[filePath]?.tier ?? "batch",
        description: descriptions.get(filePath),
        lastAnalyzed: descriptions.has(filePath)
          ? new Date().toISOString()
          : cache[filePath]?.lastAnalyzed,
      };
    } catch {
      // Skip
    }
  }
  saveHashCache(projectRoot, newCache);

  if (!options.quiet) {
    console.log(
      `\n✅ Refreshed: ${diff.changed.length + diff.added.length} updated, ${diff.removed.length} removed (${diff.unchanged.length} unchanged)`
    );
  }
}
