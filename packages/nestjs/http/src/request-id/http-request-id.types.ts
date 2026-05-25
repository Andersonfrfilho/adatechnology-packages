export interface HttpRequestIdOptions {
  /** Header principal para requestId. */
  headerName?: string;
  /** Headers alternativos aceitos para requestId. */
  fallbackHeaderNames?: string[];
  /** Gera requestId quando não vier em headers. */
  autoGenerateIfMissing?: boolean;
}

export interface ExtractRequestIdParams {
  headers: Record<string, unknown> | undefined;
  options: HttpRequestIdOptions;
}

export interface GetHeaderCaseInsensitiveParams {
  headers: Record<string, unknown>;
  name: string;
}
