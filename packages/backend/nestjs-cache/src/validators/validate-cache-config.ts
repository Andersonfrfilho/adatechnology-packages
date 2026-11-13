import { CacheConfigError } from '../errors/cache-config.error';
import type { CacheModuleOptions } from '../cache.module';

interface ValidationIssue {
  field: string;
  message: string;
}

export function validateCacheConfig(options?: CacheModuleOptions): void {
  const issues: ValidationIssue[] = [];

  if (options !== undefined && (typeof options !== 'object' || Array.isArray(options))) {
    const received = Array.isArray(options) ? 'array' : typeof options;
    throw new CacheConfigError(
      `CacheModuleOptions must be an object. Received: ${received}`,
      { statusCode: 400 },
    );
  }

  const opts = options ?? {};

  if (opts.isGlobal !== undefined && typeof opts.isGlobal !== 'boolean') {
    issues.push({
      field: 'isGlobal',
      message: `isGlobal must be a boolean. Received: ${typeof opts.isGlobal} (${opts.isGlobal})`,
    });
  }

  if (opts.encryptionSecret !== undefined) {
    if (typeof opts.encryptionSecret !== 'string') {
      issues.push({
        field: 'encryptionSecret',
        message: `encryptionSecret must be a string. Received: ${typeof opts.encryptionSecret}`,
      });
    } else if (opts.encryptionSecret.length < 16) {
      issues.push({
        field: 'encryptionSecret',
        message: `encryptionSecret must be at least 16 characters long. Received: ${opts.encryptionSecret.length} characters`,
      });
    }
  }

  if (issues.length > 0) {
    const summary = issues.map((i) => `  - ${i.field}: ${i.message}`).join('\n');
    throw new CacheConfigError(
      `CacheModuleOptions validation failed:\n${summary}`,
      { statusCode: 400, details: { issues } },
    );
  }
}
