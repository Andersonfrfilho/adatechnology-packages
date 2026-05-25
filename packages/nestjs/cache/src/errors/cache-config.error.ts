export class CacheConfigError extends Error {
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, opts?: { statusCode?: number; details?: unknown }) {
    super(message);
    this.name = 'CacheConfigError';
    this.statusCode = opts?.statusCode;
    this.details = opts?.details;
    Object.setPrototypeOf(this, CacheConfigError.prototype);
  }
}
