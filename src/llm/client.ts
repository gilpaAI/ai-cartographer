import fs from "node:fs";
import path from "node:path";
import type { LLMProvider, FileDescription } from "./types.js";
import type { ClassifiedFile } from "../classifier.js";
import type { CartographerConfig } from "../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";

export interface AnalysisResult {
  descriptions: Map<string, string>;
  pending: string[];
}

export function createProvider(config: CartographerConfig): LLMProvider {
  const apiKey =
    config.llm.apiKey ??
    (config.llm.provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error(
      `No API key found. Set ${
        config.llm.provider === "anthropic"
          ? "ANTHROPIC_API_KEY"
          : "OPENAI_API_KEY"
      } environment variable or add llm.apiKey to config.`
    );
  }

  const options = {
    apiKey,
    batchModel: config.llm.batchModel,
    deepModel: config.llm.deepModel,
    maxConcurrent: config.llm.maxConcurrent,
    rpmLimit: config.llm.rpmLimit,
  };

  if (config.llm.provider === "anthropic") {
    return new AnthropicProvider(options);
  }
  return new OpenAIProvider(options);
}

export async function analyzeFiles(
  projectRoot: string,
  files: ClassifiedFile[],
  provider: LLMProvider,
  config: CartographerConfig,
  onProgress?: (completed: number, total: number) => void
): Promise<AnalysisResult> {
  const descriptions = new Map<string, string>();
  const pending: string[] = [];

  // Add auto-skip descriptions
  const autoSkipFiles = files.filter((f) => f.tier === "auto-skip");
  for (const file of autoSkipFiles) {
    descriptions.set(file.relativePath, file.autoDescription ?? "Configuration file");
  }

  const batchFiles = files.filter((f) => f.tier === "batch");
  const deepFiles = files.filter((f) => f.tier === "deep");
  const totalToAnalyze = batchFiles.length + deepFiles.length;
  let completed = 0;

  // Process batch files
  const batchSize = config.tiers.batchSize;
  for (let i = 0; i < batchFiles.length; i += batchSize) {
    const batch = batchFiles.slice(i, i + batchSize);
    const snippets = batch.map((f) => ({
      path: f.relativePath,
      snippet: readSnippet(path.join(projectRoot, f.relativePath)),
    }));

    try {
      const results = await provider.analyzeBatch(snippets);
      for (const result of results) {
        descriptions.set(result.path, result.description);
      }
    } catch (err) {
      for (const f of batch) {
        pending.push(f.relativePath);
      }
    }

    completed += batch.length;
    onProgress?.(completed, totalToAnalyze);
  }

  // Process deep files (one at a time for richer analysis)
  for (const file of deepFiles) {
    const fullPath = path.join(projectRoot, file.relativePath);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const result = await provider.analyzeDeep({
        path: file.relativePath,
        content,
      });
      descriptions.set(result.path, result.description);
    } catch {
      pending.push(file.relativePath);
    }

    completed++;
    onProgress?.(completed, totalToAnalyze);
  }

  return { descriptions, pending };
}

function readSnippet(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // First 50 lines as snippet
    return lines.slice(0, 50).join("\n");
  } catch {
    return "";
  }
}
