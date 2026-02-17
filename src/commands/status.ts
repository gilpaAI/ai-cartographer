import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { loadConfig, resolveOutputPath } from "../config.js";
import { loadHashCache } from "../hasher.js";
import { discoverFiles } from "../discovery.js";
import { computeHashDiff } from "../hasher.js";

export async function statusCommand(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot);
  const outputPath = resolveOutputPath(projectRoot, config);

  // Check if map exists
  if (!fs.existsSync(outputPath)) {
    console.log("❌ No context map found. Run: ai-cartographer init");
    return;
  }

  const stat = fs.statSync(outputPath);
  const lastGenerated = stat.mtime;

  console.log(`📄 Context Map: ${config.outputPath}`);
  console.log(`   Last generated: ${lastGenerated.toISOString()}`);

  // Check commits since last generation
  try {
    const since = lastGenerated.toISOString();
    const commitCount = execSync(
      `git log --oneline --since="${since}" 2>/dev/null | wc -l`,
      { cwd: projectRoot, encoding: "utf-8" }
    ).trim();
    console.log(`   Commits since:  ${commitCount}`);
  } catch {
    console.log("   Commits since:  unknown (not a git repo?)");
  }

  // Check cache health
  const cache = loadHashCache(projectRoot);
  const cachedCount = Object.keys(cache).length;

  if (cachedCount === 0) {
    console.log("   Cache:          empty");
  } else {
    // Discover current files and diff
    const files = await discoverFiles(projectRoot, config);
    const filePaths = files.map((f) => f.relativePath);
    const diff = computeHashDiff(projectRoot, filePaths, cache);

    console.log(`   Cached files:   ${cachedCount}`);
    console.log(`   Current files:  ${filePaths.length}`);

    if (diff.added.length + diff.changed.length + diff.removed.length === 0) {
      console.log("   Status:         ✅ up to date");
    } else {
      console.log(
        `   Status:         ⚠️ stale (${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed)`
      );
      console.log("   Run: ai-cartographer refresh");
    }
  }

  // Map size info
  const content = fs.readFileSync(outputPath, "utf-8");
  const tokenEstimate = Math.ceil(content.length / 4);
  const lineCount = content.split("\n").length;
  console.log(`   Map size:       ${lineCount} lines, ~${tokenEstimate} tokens`);
}
