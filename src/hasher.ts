import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveCachePath } from "./config.js";

export interface HashEntry {
  hash: string;
  description?: string;
  tier: string;
  lastAnalyzed?: string;
}

export interface HashCache {
  [filePath: string]: HashEntry;
}

export interface HashDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
}

export function hashFileContent(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf-8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function loadHashCache(projectRoot: string): HashCache {
  const cachePath = path.join(resolveCachePath(projectRoot), "hashes.json");
  if (!fs.existsSync(cachePath)) return {};

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveHashCache(
  projectRoot: string,
  cache: HashCache
): void {
  const cacheDir = resolveCachePath(projectRoot);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, "hashes.json");
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

export function computeHashDiff(
  projectRoot: string,
  currentFiles: string[],
  cache: HashCache
): HashDiff {
  const diff: HashDiff = {
    added: [],
    changed: [],
    removed: [],
    unchanged: [],
  };

  const currentSet = new Set(currentFiles);

  // Check current files against cache
  for (const filePath of currentFiles) {
    const fullPath = path.join(projectRoot, filePath);
    const currentHash = hashFileContent(fullPath);
    const cached = cache[filePath];

    if (!cached) {
      diff.added.push(filePath);
    } else if (cached.hash !== currentHash) {
      diff.changed.push(filePath);
    } else {
      diff.unchanged.push(filePath);
    }
  }

  // Check for removed files
  for (const cachedPath of Object.keys(cache)) {
    if (!currentSet.has(cachedPath)) {
      diff.removed.push(cachedPath);
    }
  }

  return diff;
}

export function updateCache(
  cache: HashCache,
  projectRoot: string,
  filePath: string,
  tier: string,
  description?: string
): void {
  const fullPath = path.join(projectRoot, filePath);
  cache[filePath] = {
    hash: hashFileContent(fullPath),
    tier,
    description,
    lastAnalyzed: new Date().toISOString(),
  };
}
