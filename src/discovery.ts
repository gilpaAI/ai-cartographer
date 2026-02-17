import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import ignore from "ignore";
// @ts-ignore - ignore package export varies by version
import type { CartographerConfig } from "./config.js";

export interface FileEntry {
  relativePath: string;
  extension: string;
  sizeBytes: number;
}

export async function discoverFiles(
  projectRoot: string,
  config: CartographerConfig
): Promise<FileEntry[]> {
  const ig = (ignore as any).default ? (ignore as any).default() : (ignore as any)();

  // Load .gitignore if it exists
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
    ig.add(gitignoreContent);
  }

  // Add config ignore patterns
  ig.add(config.ignorePaths);

  // Always ignore .git
  ig.add(".git");

  const files = await fg("**/*", {
    cwd: projectRoot,
    dot: true,
    onlyFiles: true,
    absolute: false,
    ignore: config.ignorePaths.map((p) =>
      p.includes("*") ? p : `**/${p}/**`
    ),
  });

  const entries: FileEntry[] = [];

  for (const relativePath of files) {
    // Double-check against ignore rules
    if (ig.ignores(relativePath)) continue;

    // Skip binary files by extension
    if (isBinaryExtension(path.extname(relativePath))) continue;

    try {
      const fullPath = path.join(projectRoot, relativePath);
      const stat = fs.statSync(fullPath);
      entries.push({
        relativePath,
        extension: path.extname(relativePath),
        sizeBytes: stat.size,
      });
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort for deterministic output
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return entries;
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".svg",
  ".webp",
  ".avif",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".webm",
  ".ogg",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
  ".sqlite3",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".class",
  ".pyc",
  ".pyo",
  ".o",
  ".obj",
  ".a",
  ".lib",
  ".DS_Store",
  ".lock",
]);

function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext.toLowerCase());
}
