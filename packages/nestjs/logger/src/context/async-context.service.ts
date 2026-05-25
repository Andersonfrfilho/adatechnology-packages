import { AsyncLocalStorage } from "node:async_hooks";
import { RequestContext } from "./async-context.types";

export const asyncLocalStorage = new AsyncLocalStorage<
  Record<string, unknown>
>();

export function getContext(): RequestContext {
  return asyncLocalStorage.getStore();
}

export function runWithContext<T>(
  ctx: Record<string, unknown>,
  fn: () => T,
): T {
  return asyncLocalStorage.run(ctx, fn as any);
}

export function getTraceStack(): string[] {
  const ctx = getContext();
  if (!ctx) return [];
  if (!ctx.traceStack) {
    ctx.traceStack = [];
  }
  return ctx.traceStack as string[];
}

export function pushToTraceStack(method: string): void {
  const ctx = getContext();
  if (!ctx) return;
  if (!ctx.traceStack) {
    ctx.traceStack = [];
  }
  (ctx.traceStack as string[]).push(method);
}

export function popFromTraceStack(): void {
  const ctx = getContext();
  if (!ctx || !ctx.traceStack) return;
  (ctx.traceStack as string[]).pop();
}
