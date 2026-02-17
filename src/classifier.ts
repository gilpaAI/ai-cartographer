import path from "node:path";
import type { FileEntry } from "./discovery.js";
import type { CartographerConfig } from "./config.js";

export type Tier = "auto-skip" | "batch" | "deep";

export interface ClassifiedFile extends FileEntry {
  tier: Tier;
  autoDescription?: string;
}

export function classifyFiles(
  files: FileEntry[],
  config: CartographerConfig
): ClassifiedFile[] {
  return files.map((file) => classify(file, config));
}

function classify(
  file: FileEntry,
  config: CartographerConfig
): ClassifiedFile {
  // Check deep tier first (key entry points)
  if (isDeepTier(file, config)) {
    return { ...file, tier: "deep" };
  }

  // Check auto-skip tier
  const autoDesc = getAutoSkipDescription(file, config);
  if (autoDesc) {
    return { ...file, tier: "auto-skip", autoDescription: autoDesc };
  }

  // Default: batch tier
  return { ...file, tier: "batch" };
}

function isDeepTier(file: FileEntry, config: CartographerConfig): boolean {
  const { keyEntryPoints } = config;
  const deepPatterns = config.tiers.deepPatterns;

  for (const pattern of [...keyEntryPoints, ...deepPatterns]) {
    if (matchesPattern(file.relativePath, pattern)) {
      return true;
    }
  }
  return false;
}

function getAutoSkipDescription(
  file: FileEntry,
  config: CartographerConfig
): string | undefined {
  const basename = path.basename(file.relativePath);
  const { autoSkipPatterns } = config.tiers;

  // Check config patterns first
  for (const pattern of autoSkipPatterns) {
    if (matchesPattern(basename, pattern)) {
      return AUTO_DESCRIPTIONS.get(getDescriptionKey(basename)) ?? "Configuration file";
    }
  }

  // Check built-in auto-descriptions
  const desc = AUTO_DESCRIPTIONS.get(getDescriptionKey(basename));
  if (desc) return desc;

  return undefined;
}

function getDescriptionKey(filename: string): string {
  const lower = filename.toLowerCase();

  // Exact match keys
  for (const key of AUTO_DESCRIPTIONS.keys()) {
    if (key.startsWith("*.")) {
      // Extension pattern
      if (lower.endsWith(key.slice(1))) return key;
    } else if (key.includes("*")) {
      // Glob pattern — simple wildcard match
      const regex = new RegExp(
        "^" + key.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        "i"
      );
      if (regex.test(lower)) return key;
    } else {
      if (lower === key.toLowerCase()) return key;
    }
  }

  return lower;
}

const AUTO_DESCRIPTIONS = new Map<string, string>([
  ["package-lock.json", "npm dependency lockfile"],
  ["yarn.lock", "Yarn dependency lockfile"],
  ["pnpm-lock.yaml", "pnpm dependency lockfile"],
  ["bun.lockb", "Bun dependency lockfile"],
  ["*.min.js", "Minified JavaScript bundle"],
  ["*.min.css", "Minified CSS bundle"],
  ["*.d.ts", "TypeScript type declarations"],
  ["*.map", "Source map file"],
  ["*.snap", "Test snapshot file"],
  ["tsconfig.json", "TypeScript compiler configuration"],
  ["tsconfig*.json", "TypeScript compiler configuration"],
  ["jest.config.*", "Jest test configuration"],
  ["vitest.config.*", "Vitest test configuration"],
  ["vite.config.*", "Vite build configuration"],
  ["webpack.config.*", "Webpack build configuration"],
  ["rollup.config.*", "Rollup build configuration"],
  ["babel.config.*", "Babel transpiler configuration"],
  [".babelrc", "Babel transpiler configuration"],
  [".eslintrc*", "ESLint linter configuration"],
  [".prettierrc*", "Prettier formatter configuration"],
  [".editorconfig", "Editor settings (indentation, encoding)"],
  [".gitignore", "Git ignore rules"],
  [".gitattributes", "Git attributes configuration"],
  [".npmignore", "npm publish ignore rules"],
  [".npmrc", "npm registry configuration"],
  [".nvmrc", "Node.js version specification"],
  [".node-version", "Node.js version specification"],
  [".env.example", "Environment variable template"],
  ["LICENSE", "Project license"],
  ["CHANGELOG*", "Version changelog"],
  ["CONTRIBUTING*", "Contribution guidelines"],
  ["CODE_OF_CONDUCT*", "Code of conduct"],
  ["Dockerfile", "Docker container definition"],
  ["docker-compose*", "Docker multi-container orchestration"],
  ["Makefile", "Build automation rules"],
  ["Procfile", "Process manager configuration"],
  [".dockerignore", "Docker build ignore rules"],
]);

function matchesPattern(filepath: string, pattern: string): boolean {
  const filename = path.basename(filepath);

  if (pattern.includes("/")) {
    // Path pattern
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      "i"
    );
    return regex.test(filepath);
  }

  // Filename pattern
  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    "i"
  );
  return regex.test(filename);
}

export function getTierSummary(files: ClassifiedFile[]): {
  autoSkip: number;
  batch: number;
  deep: number;
  total: number;
} {
  return {
    autoSkip: files.filter((f) => f.tier === "auto-skip").length,
    batch: files.filter((f) => f.tier === "batch").length,
    deep: files.filter((f) => f.tier === "deep").length,
    total: files.length,
  };
}

export function estimateCost(
  files: ClassifiedFile[],
  batchSize: number
): { batchCalls: number; deepCalls: number; estimatedCost: string } {
  const batchFiles = files.filter((f) => f.tier === "batch").length;
  const deepFiles = files.filter((f) => f.tier === "deep").length;
  const batchCalls = Math.ceil(batchFiles / batchSize);
  const deepCalls = deepFiles;

  // Rough cost estimate: batch call ~$0.003, deep call ~$0.01
  const cost = batchCalls * 0.003 + deepCalls * 0.01;

  return {
    batchCalls,
    deepCalls,
    estimatedCost: `$${cost.toFixed(2)}`,
  };
}
