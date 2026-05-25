import { AxiosInstance, AxiosRequestConfig } from "axios";

// Minimal duplication of HttpModuleOptions to avoid relative import issues during build
export interface HttpModuleOptions {
  logging?: {
    enabled?: boolean;
    environments?: string[];
    types?: Array<"request" | "response" | "error">;
    includeHeaders?: boolean;
    includeBody?: boolean;
    context?: string;
    requestId?: { autoGenerateIfMissing?: boolean; headerName?: string };
  };
}

export type AxiosForRootParam =
  | AxiosRequestConfig
  | AxiosInstance
  | {
      config?: AxiosRequestConfig | AxiosInstance;
      options?: HttpModuleOptions;
    };

export type AxiosForRootOptions = HttpModuleOptions;
