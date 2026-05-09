import type { BaseChatCompletionMessage } from "../common.js";

export type MiddlewareFn = (
  messages: BaseChatCompletionMessage[],
  context: Record<string, unknown>
) => BaseChatCompletionMessage[] | Promise<BaseChatCompletionMessage[]>;

export interface MiddlewareContext {
  model?: string;
  provider?: string;
  retryCount?: number;
  startTime?: number;
  [key: string]: unknown;
}

export class MiddlewareChain {
  private middlewares: MiddlewareFn[] = [];

  use(fn: MiddlewareFn): this {
    this.middlewares.push(fn);
    return this;
  }

  async execute(
    messages: BaseChatCompletionMessage[],
    initialContext: Record<string, unknown> = {}
  ): Promise<BaseChatCompletionMessage[]> {
    let currentMessages = messages;
    let context: Record<string, unknown> = { ...initialContext };

    for (const middleware of this.middlewares) {
      const result = await middleware(currentMessages, context);
      if (Array.isArray(result)) {
        currentMessages = result;
      }
    }

    return currentMessages;
  }

  clear(): void {
    this.middlewares = [];
  }
}

export function createLoggingMiddleware(
  logger: (msg: string) => void = console.log
): MiddlewareFn {
  return async (messages, context) => {
    logger(`[Middleware] Processing ${messages.length} messages`);
    logger(`[Middleware] Context: ${JSON.stringify(context)}`);
    return messages;
  };
}

export function createRateLimitMiddleware(
  maxRequestsPerMinute: number
): MiddlewareFn {
  let requestCount = 0;
  let windowStart = Date.now();

  return async (messages, context) => {
    const now = Date.now();
    if (now - windowStart > 60000) {
      requestCount = 0;
      windowStart = now;
    }

    requestCount++;

    if (requestCount > maxRequestsPerMinute) {
      throw new Error(`Rate limit exceeded: ${maxRequestsPerMinute} requests per minute`);
    }

    context["rateLimitCount"] = requestCount;
    return messages;
  };
}

export function createAuthMiddleware(
  getApiKey: () => string | undefined
): MiddlewareFn {
  return async (messages, context) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("API key not configured");
    }
    context["apiKey"] = apiKey;
    return messages;
  };
}

export function createMetricsMiddleware(
  onMetrics: (metrics: RequestMetrics) => void
): MiddlewareFn {
  return async (messages, context) => {
    const startTime = Date.now();
    context["startTime"] = startTime;

    const originalMessages = messages;

    return async function passthrough(
      msgs: BaseChatCompletionMessage[],
      ctx: Record<string, unknown>
    ): Promise<BaseChatCompletionMessage[]> {
      const endTime = Date.now();
      onMetrics({
        durationMs: endTime - (ctx["startTime"] as number || startTime),
        messageCount: msgs.length,
        timestamp: endTime,
      });
      return msgs;
    } as unknown as BaseChatCompletionMessage[];
  };
}

export interface RequestMetrics {
  durationMs: number;
  messageCount: number;
  timestamp: number;
}

export function createRetryMiddleware(
  maxRetries: number,
  shouldRetry: (error: Error) => boolean
): MiddlewareFn {
  return async (messages, context) => {
    let retryCount = (context["retryCount"] as number) || 0;

    while (retryCount < maxRetries) {
      try {
        context["retryCount"] = retryCount;
        return messages;
      } catch (error) {
        if (error instanceof Error && shouldRetry(error)) {
          retryCount++;
          continue;
        }
        throw error;
      }
    }

    return messages;
  };
}

export const defaultMiddlewareChain = new MiddlewareChain();