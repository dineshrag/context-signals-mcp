import type { ProviderName, CompletionParams, ChatCompletionResponse } from "./providers/openai.js";
import { OpenAIProvider, createOpenAIProvider } from "./providers/openai.js";
import { getConfigStore, type ModelConfig } from "./providers/config.js";

export interface LiteLLMOptions {
  provider?: ProviderName;
  apiKey?: string;
  apiBase?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOnTimeout: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryOnTimeout: true,
};

let globalOptions: LiteLLMOptions = {};
let retryConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG };

export function configure(options: LiteLLMOptions): void {
  globalOptions = { ...globalOptions, ...options };
}

export function configureRetry(config: Partial<RetryConfig>): void {
  retryConfig = { ...retryConfig, ...config };
}

export async function completion(
  params: CompletionParams & { model?: string }
): Promise<ChatCompletionResponse> {
  const configStore = getConfigStore();
  const modelName = params.model || "gpt-3.5-turbo";

  const modelConfig = configStore.getModelConfig(modelName);
  const provider = modelConfig?.provider || globalOptions.provider || "openai";
  const apiKey = modelConfig?.apiKey || globalOptions.apiKey;
  const apiBase = modelConfig?.apiBase || globalOptions.apiBase;

  const providerConfig = {
    name: provider,
    apiKey,
    apiBase,
    maxRetries: retryConfig.maxRetries,
    timeout: globalOptions.timeout || 60000,
  };

  const providerInstance = createOpenAIProvider(providerConfig);
  return providerInstance.completion(params);
}

export async function completionWithRetry(
  params: CompletionParams,
  retryOpts?: Partial<RetryConfig>
): Promise<ChatCompletionResponse> {
  const config = { ...retryConfig, ...retryOpts };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await completion(params);
    } catch (error) {
      lastError = error as Error;

      if (attempt < config.maxRetries) {
        const shouldRetry = shouldRetryError(error, config.retryOnTimeout);
        if (!shouldRetry) throw error;

        const delay = calculateBackoffDelay(attempt, config);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function shouldRetryError(error: unknown, retryOnTimeout: boolean): boolean {
  if (error instanceof Error) {
    if (error.message.includes("timeout")) return retryOnTimeout;
    if (error.message.includes("rate_limit")) return true;
    if (error.message.includes("429")) return true;
    if (error.message.includes("500")) return true;
    if (error.message.includes("502")) return true;
    if (error.message.includes("503")) return true;
  }
  return false;
}

function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* completionStream(
  params: CompletionParams,
  retryOpts?: Partial<RetryConfig>
): AsyncGenerator<Awaited<ReturnType<typeof completion>>["choices"][0], void, unknown> {
  const configStore = getConfigStore();
  const modelName = params.model || "gpt-3.5-turbo";

  const modelConfig = configStore.getModelConfig(modelName);
  const provider = modelConfig?.provider || globalOptions.provider || "openai";
  const apiKey = modelConfig?.apiKey || globalOptions.apiKey;
  const apiBase = modelConfig?.apiBase || globalOptions.apiBase;

  const providerConfig = {
    name: provider,
    apiKey,
    apiBase,
    maxRetries: retryConfig.maxRetries,
    timeout: globalOptions.timeout || 60000,
  };

  const providerInstance = createOpenAIProvider(providerConfig);
  let accumulatedContent = "";

  await providerInstance.completionStream(params, (chunk) => {
    const content = chunk.choices[0]?.delta?.content || "";
    accumulatedContent += content;
  });

  const response = await completion({ ...params, stream: false });
  yield response.choices[0];
}

export function modelRouter(modelName: string): ProviderName {
  if (modelName.startsWith("gpt-")) return "openai";
  if (modelName.startsWith("claude-")) return "anthropic";
  if (modelName.startsWith("gemini-")) return "gemini";
  if (modelName.startsWith("azure/")) return "azure";
  if (modelName.startsWith("ollama/")) return "ollama";
  if (modelName.startsWith("together/")) return "together";
  return "openai";
}

export function getSupportedProviders(): ProviderName[] {
  return ["openai", "anthropic", "azure", "gemini", "ollama", "together"];
}

export function isProviderAvailable(provider: ProviderName): boolean {
  const configStore = getConfigStore();
  return configStore.getProviderConfig(provider) !== undefined;
}

export { getConfigStore } from "./providers/config.js";
export type { ProviderName, ProviderConfig, CompletionParams, ChatCompletionResponse } from "./providers/openai.js";
export type { ModelConfig, ConfigStore } from "./providers/config.js";