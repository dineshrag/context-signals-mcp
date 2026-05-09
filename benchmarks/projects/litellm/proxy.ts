import type { ProviderName, CompletionParams, ChatCompletionResponse } from "./providers/openai.js";
import { getConfigStore, type ModelConfig } from "./providers/config.js";
import { modelRouter } from "./index.js";
import { LiteLLMError } from "./utils/common.js";

export interface ProxyConfig {
  host: string;
  port: number;
  ssl?: boolean;
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  healthCheckInterval?: number;
}

export interface ProxyRoute {
  provider: ProviderName;
  modelPrefix: string;
  weight: number;
}

const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  host: "0.0.0.0",
  port: 8000,
  ssl: false,
  maxConcurrentRequests: 100,
  requestTimeout: 60000,
  healthCheckInterval: 30000,
};

class LoadBalancer {
  private routes: ProxyRoute[] = [];
  private routeWeights: Map<string, number> = new Map();

  addRoute(route: ProxyRoute): void {
    this.routes.push(route);
    this.routeWeights.set(`${route.provider}:${route.modelPrefix}`, route.weight);
  }

  removeRoute(provider: ProviderName, modelPrefix: string): void {
    this.routes = this.routes.filter(
      (r) => !(r.provider === provider && r.modelPrefix === modelPrefix)
    );
    this.routeWeights.delete(`${provider}:${modelPrefix}`);
  }

  selectRoute(modelName: string): ProxyRoute | null {
    const matchingRoutes = this.routes.filter((r) => modelName.startsWith(r.modelPrefix));

    if (matchingRoutes.length === 0) {
      const defaultProvider = modelRouter(modelName);
      return {
        provider: defaultProvider,
        modelPrefix: "",
        weight: 1,
      };
    }

    const totalWeight = matchingRoutes.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    for (const route of matchingRoutes) {
      random -= route.weight;
      if (random <= 0) return route;
    }

    return matchingRoutes[matchingRoutes.length - 1];
  }

  getRoutes(): ProxyRoute[] {
    return [...this.routes];
  }
}

class HealthChecker {
  private providerHealth: Map<ProviderName, boolean> = new Map();
  private lastCheckTime: Map<ProviderName, number> = new Map();

  async checkProvider(provider: ProviderName): Promise<boolean> {
    const configStore = getConfigStore();
    const config = configStore.getProviderConfig(provider);

    if (!config || !config.apiKey) {
      this.providerHealth.set(provider, false);
      return false;
    }

    try {
      const isHealthy = await this.performHealthCheck(config);
      this.providerHealth.set(provider, isHealthy);
      this.lastCheckTime.set(provider, Date.now());
      return isHealthy;
    } catch {
      this.providerHealth.set(provider, false);
      return false;
    }
  }

  private async performHealthCheck(config: { apiBase?: string; apiKey?: string }): Promise<boolean> {
    const testUrl = `${config.apiBase || "https://api.openai.com/v1"}/models`;
    try {
      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  isHealthy(provider: ProviderName): boolean {
    return this.providerHealth.get(provider) ?? false;
  }

  getLastCheckTime(provider: ProviderName): number | undefined {
    return this.lastCheckTime.get(provider);
  }
}

export class ProxyServer {
  private config: ProxyConfig;
  private loadBalancer: LoadBalancer;
  private healthChecker: HealthChecker;
  private isRunning: boolean = false;

  constructor(config: Partial<ProxyConfig> = {}) {
    this.config = { ...DEFAULT_PROXY_CONFIG, ...config };
    this.loadBalancer = new LoadBalancer();
    this.healthChecker = new HealthChecker();
  }

  async routeRequest(modelName: string, params: CompletionParams): Promise<ChatCompletionResponse> {
    if (!this.isRunning) {
      throw new LiteLLMError("Proxy server not running", "invalid_request_error");
    }

    const route = this.loadBalancer.selectRoute(modelName);
    if (!route) {
      throw new LiteLLMError(`No route found for model: ${modelName}`, "not_found_error");
    }

    if (!this.healthChecker.isHealthy(route.provider)) {
      throw new LiteLLMError(
        `Provider ${route.provider} is not healthy`,
        "api_error"
      );
    }

    return this.forwardToProvider(route.provider, params);
  }

  private async forwardToProvider(
    provider: ProviderName,
    params: CompletionParams
  ): Promise<ChatCompletionResponse> {
    const configStore = getConfigStore();
    const config = configStore.getProviderConfig(provider);

    if (!config || !config.apiKey) {
      throw new LiteLLMError(`Provider ${provider} not configured`, "auth_error");
    }

    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LiteLLMError(
        errorData.error?.message || `API error: ${response.status}`,
        "api_error",
        response.status
      );
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  addProviderRoute(provider: ProviderName, modelPrefix: string, weight = 1): void {
    this.loadBalancer.addRoute({ provider, modelPrefix, weight });
  }

  removeProviderRoute(provider: ProviderName, modelPrefix: string): void {
    this.loadBalancer.removeRoute(provider, modelPrefix);
  }

  async start(): Promise<void> {
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  getStatus(): {
    running: boolean;
    routes: ProxyRoute[];
    providerHealth: Map<ProviderName, boolean>;
  } {
    return {
      running: this.isRunning,
      routes: this.loadBalancer.getRoutes(),
      providerHealth: new Map(this.healthChecker.providerHealth),
    };
  }
}

export function createProxyServer(config?: Partial<ProxyConfig>): ProxyServer {
  return new ProxyServer(config);
}

export { LoadBalancer, HealthChecker };