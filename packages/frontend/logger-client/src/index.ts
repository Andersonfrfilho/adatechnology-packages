/**
 * @cawme/logger-client
 * Isomorphic client logger with automatic request tracing correlation.
 * Works in mobile (React Native), web (React/Vue/Angular), Node.js, and Electron.
 * 
 * Generates requestId, manages traceId from server, correlates with backend logs/traces.
 */

/**
 * Generate a UUID v4-like string for requestId
 */
function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface TraceContextOptions {
  requestId?: string;
  storageKey?: string;
  traceIdHeaderName?: string;
  requestIdHeaderName?: string;
}

export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  requestId: string;
  traceId?: string;
  message: string;
  data?: unknown;
}

/**
 * TraceContext manages request correlation across client and server.
 * 
 * Usage:
 * ```typescript
 * // React Native (mobile)
 * import { TraceContext } from '@cawme/logger-client';
 * 
 * const trace = new TraceContext();
 * 
 * // All fetch requests include requestId + traceId headers
 * const response = await trace.fetch('https://gateway.domestic.local/bff/onboarding/register', {
 *   method: 'POST',
 *   body: JSON.stringify(userData),
 * });
 * 
 * // Logs include context
 * trace.info('User registered', { userId: response.keycloakId });
 * // Output: [uuid][traceId] User registered { userId: ... }
 * ```
 */
export class TraceContext {
  readonly requestId: string;
  traceId?: string;

  private storageKey: string;
  private traceIdHeaderName: string;
  private requestIdHeaderName: string;

  constructor(options: TraceContextOptions = {}) {
    this.requestId = options.requestId || generateRequestId();
    this.storageKey = options.storageKey || '@cawme/trace-id';
    this.traceIdHeaderName = options.traceIdHeaderName || 'X-Trace-Id';
    this.requestIdHeaderName = options.requestIdHeaderName || 'X-Request-Id';

    // Try to restore traceId from storage
    this.restoreTraceId();
  }

  /**
   * Store traceId in browser/app storage for persistence
   */
  private saveTraceId(): void {
    if (typeof localStorage !== 'undefined' && this.traceId) {
      try {
        localStorage.setItem(this.storageKey, this.traceId);
      } catch {
        // Storage may be unavailable or full
      }
    }
  }

  /**
   * Restore traceId from storage
   */
  private restoreTraceId(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) this.traceId = stored;
      } catch {
        // Storage may be unavailable
      }
    }
  }

  /**
   * Wrapper around fetch() that:
   * - Adds X-Request-Id and X-Trace-Id headers automatically
   * - Extracts and stores traceId from response
   * - Returns Response as-is for chaining
   * 
   * @example
   * const response = await trace.fetch('/api/data', { method: 'POST', body: ... });
   * const json = await response.json();
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const headers = {
      ...options.headers,
      [this.requestIdHeaderName]: this.requestId,
    };

    // Add traceId if available from previous requests
    if (this.traceId) {
      headers[this.traceIdHeaderName] = this.traceId;
    }

    const response = await fetch(url, { ...options, headers });

    // Extract and store traceId from response for next requests
    const responseTraceId = response.headers.get(
      this.traceIdHeaderName.toLowerCase(),
    );
    if (responseTraceId) {
      this.traceId = responseTraceId;
      this.saveTraceId();
    }

    return response;
  }

  /**
   * Log with automatic context injection
   * 
   * @example
   * trace.info('User action', { action: 'register', email: 'user@example.com' });
   * // Outputs: [requestId][traceId] User action { action: ..., email: ... }
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      traceId: this.traceId,
      message,
      data,
    };

    // Output to console with formatting
    const prefix = `[${this.requestId}]${this.traceId ? `[${this.traceId}]` : ''}`;
    const consoleFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log;

    consoleFn(`${prefix} ${message}`, data);

    return entry;
  }

  debug(message: string, data?: unknown): LogEntry {
    return this.log('debug', message, data);
  }

  info(message: string, data?: unknown): LogEntry {
    return this.log('info', message, data);
  }

  warn(message: string, data?: unknown): LogEntry {
    return this.log('warn', message, data);
  }

  error(message: string, data?: unknown): LogEntry {
    return this.log('error', message, data);
  }

  /**
   * Get current context for embedding in logs or analytics
   */
  getContext() {
    return {
      requestId: this.requestId,
      traceId: this.traceId,
    };
  }

  /**
   * Reset traceId (e.g., on logout or new session)
   */
  resetTraceId(): void {
    this.traceId = undefined;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.storageKey);
      } catch {
        // Storage may be unavailable
      }
    }
  }
}

/**
 * Global instance (optional convenience export)
 */
let globalInstance: TraceContext | null = null;

export function initTraceContext(
  options?: TraceContextOptions,
): TraceContext {
  if (!globalInstance) {
    globalInstance = new TraceContext(options);
  }
  return globalInstance;
}

export function getGlobalTraceContext(): TraceContext | null {
  return globalInstance;
}
