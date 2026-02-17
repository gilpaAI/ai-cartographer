export interface FileDescription {
  path: string;
  description: string;
}

export interface LLMProvider {
  analyzeBatch(
    files: Array<{ path: string; snippet: string }>
  ): Promise<FileDescription[]>;

  analyzeDeep(file: {
    path: string;
    content: string;
  }): Promise<FileDescription>;
}

export interface LLMProviderOptions {
  apiKey: string;
  batchModel: string;
  deepModel: string;
  maxConcurrent: number;
  rpmLimit: number;
}
