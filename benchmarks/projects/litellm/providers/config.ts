import type { ProviderName, ProviderConfig } from "./openai.js";

export interface ModelConfig {
  modelName: string;
  provider: ProviderName;
  apiKey?: string;
  apiBase?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ConfigStore {
  getProviderConfig(provider: ProviderName): ProviderConfig | undefined;
  getModelConfig(modelName: string): ModelConfig | undefined;
  setProviderConfig(provider: ProviderName, config: ProviderConfig): void;
  setModelConfig(modelName: string, config: ModelConfig): void;
  listProviders(): ProviderName[];
  listModels(): string[];
}

class MemoryConfigStore implements ConfigStore {
  private providerConfigs: Map<ProviderName, ProviderConfig> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();

  getProviderConfig(provider: ProviderName): ProviderConfig | undefined {
    return this.providerConfigs.get(provider);
  }

  getModelConfig(modelName: string): ModelConfig | undefined {
    return this.modelConfigs.get(modelName);
  }

  setProviderConfig(provider: ProviderName, config: ProviderConfig): void {
    this.providerConfigs.set(provider, config);
  }

  setModelConfig(modelName: string, config: ModelConfig): void {
    this.modelConfigs.set(modelName, config);
  }

  listProviders(): ProviderName[] {
    return Array.from(this.providerConfigs.keys());
  }

  listModels(): string[] {
    return Array.from(this.modelConfigs.keys());
  }
}

class EnvironmentConfigStore implements ConfigStore {
  getProviderConfig(provider: ProviderName): ProviderConfig | undefined {
    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey) return undefined;

    return {
      name: provider,
      apiKey,
      apiBase: process.env[`${provider.toUpperCase()}_API_BASE`],
      timeout: this.parseIntEnv(`${provider.toUpperCase()}_TIMEOUT`, 60000),
      maxRetries: this.parseIntEnv(`${provider.toUpperCase()}_MAX_RETRIES`, 3),
    };
  }

  getModelConfig(modelName: string): ModelConfig | undefined {
    const provider = this.inferProvider(modelName);
    if (!provider) return undefined;

    const providerConfig = this.getProviderConfig(provider);
    if (!providerConfig) return undefined;

    return {
      modelName,
      provider,
      apiKey: providerConfig.apiKey,
      apiBase: providerConfig.apiBase,
      timeout: providerConfig.timeout,
      maxTokens: this.parseIntEnv("DEFAULT_MAX_TOKENS", 4096),
      temperature: this.parseFloatEnv("DEFAULT_TEMPERATURE", 0.7),
    };
  }

  setProviderConfig(provider: ProviderName, config: ProviderConfig): void {
    if (config.apiKey) {
      process.env[`${provider.toUpperCase()}_API_KEY`] = config.apiKey;
    }
    if (config.apiBase) {
      process.env[`${provider.toUpperCase()}_API_BASE`] = config.apiBase;
    }
  }

  setModelConfig(modelName: string, config: ModelConfig): void {
    this.modelConfigs.set(modelName, config);
  }

  listProviders(): ProviderName[] {
    const providers: ProviderName[] = ["openai", "anthropic", "azure", "gemini", "ollama", "together"];
    return providers.filter((p) => process.env[`${p.toUpperCase()}_API_KEY`]);
  }

  listModels(): string[] {
    return Array.from(this.modelConfigs.keys());
  }

  private inferProvider(modelName: string): ProviderName | undefined {
    if (modelName.startsWith("gpt-")) return "openai";
    if (modelName.startsWith("claude-")) return "anthropic";
    if (modelName.startsWith("gemini-")) return "gemini";
    if (modelName.startsWith("azure/")) return "azure";
    return undefined;
  }

  private parseIntEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }

  private parseFloatEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseFloat(value) : defaultValue;
  }

  private modelConfigs: Map<string, ModelConfig> = new Map();
}

let globalConfigStore: ConfigStore | null = null;

export function getConfigStore(): ConfigStore {
  if (!globalConfigStore) {
    globalConfigStore = new EnvironmentConfigStore();
  }
  return globalConfigStore;
}

export function setConfigStore(store: ConfigStore): void {
  globalConfigStore = store;
}

export function mergeConfigs<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
  defaults: T
): T {
  const result = { ...defaults, ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {
    const overrideValue = override[key];
    if (overrideValue !== undefined) {
      if (overrideValue && typeof overrideValue === "object" && !Array.isArray(overrideValue)) {
        result[key] = mergeConfigs(
          result[key] as Record<string, unknown>,
          overrideValue as Record<string, unknown>,
          {} as Record<string, unknown>
        ) as T[keyof T];
      } else {
        result[key] = overrideValue as T[keyof T];
      }
    }
  }

  return result;
}