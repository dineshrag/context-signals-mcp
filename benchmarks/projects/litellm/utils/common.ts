export type BaseChatCompletionRole = "system" | "user" | "assistant" | "function";

export interface BaseChatCompletionMessage {
  role: BaseChatCompletionRole;
  content: string | null;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export interface BaseChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: BaseChatCompletionRole;
      content?: string;
      functionCall?: {
        name: string;
        arguments: string;
      };
    };
    finishReason: "stop" | "length" | null;
  }[];
}

export interface BaseChatCompletionFunction {
  name: string;
  description?: string;
  parameters?: {
    type: "object";
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ChatCompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type ErrorCode =
  | "auth_error"
  | "rate_limit_error"
  | "timeout_error"
  | "api_error"
  | "validation_error"
  | "not_found_error"
  | "invalid_request_error";

export class LiteLLMError extends Error {
  code: ErrorCode;
  statusCode?: number;

  constructor(message: string, code: ErrorCode, statusCode?: number) {
    super(message);
    this.name = "LiteLLMError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isLiteLLMError(error: unknown): error is LiteLLMError {
  return error instanceof LiteLLMError;
}