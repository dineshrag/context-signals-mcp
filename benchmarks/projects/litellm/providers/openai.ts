import type {
  BaseChatCompletionChunk,
  BaseChatCompletionMessage,
  BaseChatCompletionRole,
  BaseChatCompletionFunction,
} from "./common.js";

export type ProviderName = "openai" | "anthropic" | "azure" | "gemini" | "ollama" | "together";

export interface ProviderConfig {
  name: ProviderName;
  apiKey?: string;
  apiBase?: string;
  apiVersion?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  localMode?: boolean;
}

export interface CompletionParams {
  model: string;
  messages: BaseChatCompletionMessage[];
  temperature?: number;
  topP?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  logitBias?: Record<string, number>;
  user?: string;
  functions?: BaseChatCompletionFunction[];
  functionCall?: string | { name: string };
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: BaseChatCompletionMessage;
    finishReason: "stop" | "length" | "functionCall" | "contentFilter" | null;
  }[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class OpenAIProvider {
  private config: ProviderConfig;
  private baseURL: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseURL = config.apiBase || "https://api.openai.com/v1";
  }

  async completion(params: CompletionParams): Promise<ChatCompletionResponse> {
    const { model, messages, temperature, topP, maxTokens, stream } = params;

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })),
    };

    if (temperature !== undefined) requestBody.temperature = temperature;
    if (topP !== undefined) requestBody.top_p = topP;
    if (maxTokens !== undefined) requestBody.max_tokens = maxTokens;
    if (stream !== undefined) requestBody.stream = stream;

    const url = `${this.baseURL}/chat/completions`;
    const headers = this.buildHeaders();

    const response = await this.executeWithRetry(
      () => fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      }),
      this.config.maxRetries || 3
    );

    return response.json() as Promise<ChatCompletionResponse>;
  }

  async completionStream(
    params: CompletionParams,
    onChunk: (chunk: BaseChatCompletionChunk) => void
  ): Promise<void> {
    const { model, messages, temperature, maxTokens } = params;

    const requestBody = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })),
      stream: true,
    };

    if (temperature !== undefined) requestBody.temperature = temperature;
    if (maxTokens !== undefined) requestBody.max_tokens = maxTokens;

    const url = `${this.baseURL}/chat/completions`;
    const headers = this.buildHeaders();

    const response = await this.executeWithRetry(
      () => fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      }),
      this.config.maxRetries || 3
    );

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const chunk = JSON.parse(data) as BaseChatCompletionChunk;
            onChunk(chunk);
          } catch {}
        }
      }
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.organization) {
      headers["OpenAI-Organization"] = this.config.organization;
    }

    return headers;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number,
    backoff = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;

      const delay = backoff * Math.pow(2, 3 - retries);
      await this.sleep(delay);

      return this.executeWithRetry(fn, retries - 1, backoff);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createOpenAIProvider(config: ProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}