import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  LLMProvider,
  LLMProviderOptions,
  FileDescription,
} from "./types.js";

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private batchModel: string;
  private deepModel: string;

  constructor(options: LLMProviderOptions) {
    this.client = new GoogleGenerativeAI(options.apiKey);
    this.batchModel = options.batchModel;
    this.deepModel = options.deepModel;
  }

  async analyzeBatch(
    files: Array<{ path: string; snippet: string }>
  ): Promise<FileDescription[]> {
    const fileList = files
      .map(
        (f, i) =>
          `[${i + 1}] ${f.path}\n\`\`\`\n${f.snippet.slice(0, 500)}\n\`\`\``
      )
      .join("\n\n");

    const model = this.client.getGenerativeModel({ model: this.batchModel });

    const result = await model.generateContent(
      `You are analyzing source code files. For each file below, write a single concise sentence (max 15 words) describing what the file does. Focus on PURPOSE and INTENT, not implementation details.

Return ONLY a JSON array of objects with "path" and "description" fields. No markdown, no explanation.

Files:

${fileList}`
    );

    const text = result.response.text();

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found");
      return JSON.parse(jsonMatch[0]);
    } catch {
      return files.map((f) => ({
        path: f.path,
        description: "Analysis pending — LLM response parse error",
      }));
    }
  }

  async analyzeDeep(file: {
    path: string;
    content: string;
  }): Promise<FileDescription> {
    const truncated = file.content.slice(0, 12000);

    const model = this.client.getGenerativeModel({ model: this.deepModel });

    const result = await model.generateContent(
      `You are analyzing a key source code file. Write a concise description (1-2 sentences, max 30 words) of what this file does. Focus on its PURPOSE, ROLE in the project, and KEY RESPONSIBILITIES.

File: ${file.path}

\`\`\`
${truncated}
\`\`\`

Return ONLY the description text, nothing else.`
    );

    const description = result.response.text().trim();
    return { path: file.path, description };
  }
}
