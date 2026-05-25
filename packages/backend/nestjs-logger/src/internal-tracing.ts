/**
 * Re-export initTracing from the implementation to ensure it's in the compiled output.
 * This is needed because tsup doesn't properly handle the dynamic requires in init-tracing.ts
 */
// @ts-expect-error - Dynamic require is handled at runtime
export function initTracing(config?: any): void {
  // Import dynamically at call time to avoid module resolution issues
  const impl = require('./tracing/init-tracing');
  impl.initTracing(config);
}

export type { TracingConfig } from './tracing/tracing.config';
