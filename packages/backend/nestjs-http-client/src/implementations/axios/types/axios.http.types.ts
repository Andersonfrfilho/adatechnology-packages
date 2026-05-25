// Local minimal duplication of types to avoid relative import resolution issues
export interface HttpExternalLogger {
  debug?(payload: {
    message: string;
    context?: string;
    meta?: Record<string, unknown>;
  }): void;
  info?(payload: {
    message: string;
    context?: string;
    meta?: Record<string, unknown>;
  }): void;
  warn?(payload: {
    message: string;
    context?: string;
    meta?: Record<string, unknown>;
  }): void;
  error?(payload: {
    message: string;
    context?: string;
    meta?: Record<string, unknown>;
  }): void;
}

export interface HttpLoggingConfig {
  enabled?: boolean;
  environments?: string[];
  types?: Array<"request" | "response" | "error">;
  includeHeaders?: boolean;
  includeBody?: boolean;
  context?: string;
  requestId?: { autoGenerateIfMissing?: boolean; headerName?: string };
}

export type AxiosHttpProviderOptions = {
  logger?: HttpExternalLogger;
  logging?: HttpLoggingConfig;
  cache?: { defaultTtl?: number; keyPrefix?: string };
};
