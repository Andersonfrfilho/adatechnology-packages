export type RequestContext = (Record<string, unknown> & {
  traceStack?: string[];
}) | undefined;
