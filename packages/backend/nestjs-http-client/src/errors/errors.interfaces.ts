export interface ErrorContext {
  service?: string;
  url?: string;
  method?: string;
  origin?: { file?: string; fn?: string; line?: number; column?: number };
  stack?: Array<{ fn?: string; file?: string; line?: number; column?: number }>;
  [key: string]: any;
}

export type BaseAppErrorParams<Context = ErrorContext> = {
  message: string;
  status?: number;
  code?: string;
  context?: Context;
};
