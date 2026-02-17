import { cosmiconfig } from "cosmiconfig";
import path from "node:path";

export interface TierConfig {
  autoSkipPatterns: string[];
  deepPatterns: string[];
  batchSize: number;
}

export interface LLMConfig {
  provider: "anthropic" | "openai";
  apiKey?: string;
  batchModel: string;
  deepModel: string;
  maxConcurrent: number;
  rpmLimit: number;
}

export interface CartographerConfig {
  outputPath: string;
  ignorePaths: string[];
  keyEntryPoints: string[];
  tiers: TierConfig;
  llm: LLMConfig;
}

const DEFAULT_CONFIG: CartographerConfig = {
  outputPath: ".ai/context-map.md",
  ignorePaths: [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "vendor",
    "__pycache__",
    ".next",
    ".nuxt",
    "coverage",
    ".nyc_output",
    ".cache",
    ".turbo",
    ".vercel",
    ".ai/.cache",
  ],
  keyEntryPoints: [],
  tiers: {
    autoSkipPatterns: [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
      "*.min.js",
      "*.min.css",
      "*.d.ts",
      "*.map",
      "*.snap",
      ".eslintrc*",
      ".prettierrc*",
      "tsconfig*.json",
      "jest.config.*",
      "vitest.config.*",
      "vite.config.*",
      "webpack.config.*",
      "rollup.config.*",
      "babel.config.*",
      ".babelrc",
      ".editorconfig",
      ".gitignore",
      ".gitattributes",
      ".npmignore",
      ".npmrc",
      ".nvmrc",
      ".node-version",
      ".env.example",
      "LICENSE",
      "CHANGELOG*",
      "CONTRIBUTING*",
      "CODE_OF_CONDUCT*",
      "Dockerfile",
      "docker-compose*",
      "Makefile",
      "Procfile",
      ".dockerignore",
    ],
    deepPatterns: [],
    batchSize: 15,
  },
  llm: {
    provider: "anthropic",
    batchModel: "claude-haiku-4-5-20251001",
    deepModel: "claude-sonnet-4-5-20250929",
    maxConcurrent: 5,
    rpmLimit: 50,
  },
};

export async function loadConfig(
  projectRoot: string
): Promise<CartographerConfig> {
  const explorer = cosmiconfig("cartographer", {
    searchPlaces: [
      ".ai/cartographer.config.json",
      ".ai/cartographer.config.yaml",
      ".ai/cartographer.config.yml",
      ".ai/cartographer.config.js",
    ],
  });

  const result = await explorer.search(projectRoot);

  if (!result || result.isEmpty) {
    return DEFAULT_CONFIG;
  }

  return mergeConfig(DEFAULT_CONFIG, result.config);
}

function mergeConfig(
  defaults: CartographerConfig,
  overrides: Partial<CartographerConfig>
): CartographerConfig {
  return {
    outputPath: overrides.outputPath ?? defaults.outputPath,
    ignorePaths: overrides.ignorePaths ?? defaults.ignorePaths,
    keyEntryPoints: overrides.keyEntryPoints ?? defaults.keyEntryPoints,
    tiers: {
      ...defaults.tiers,
      ...overrides.tiers,
    },
    llm: {
      ...defaults.llm,
      ...overrides.llm,
    },
  };
}

export function resolveOutputPath(
  projectRoot: string,
  config: CartographerConfig
): string {
  return path.resolve(projectRoot, config.outputPath);
}

export function resolveCachePath(projectRoot: string): string {
  return path.resolve(projectRoot, ".ai", ".cache");
}
