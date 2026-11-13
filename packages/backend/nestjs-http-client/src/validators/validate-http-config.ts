import { HttpConfigError } from "../errors/http-config.error";
import type { HttpModuleOptions } from "../http.interface";

interface ValidationIssue {
  field: string;
  message: string;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeAxiosConfig(obj: any): boolean {
  return (
    obj &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    (obj.baseURL !== undefined ||
      obj.timeout !== undefined ||
      obj.headers !== undefined)
  );
}

function validateAxiosConfig(config: any, pathPrefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (config.baseURL !== undefined) {
    if (typeof config.baseURL !== "string") {
      issues.push({
        field: `${pathPrefix}.baseURL`,
        message: `baseURL must be a string. Received: ${typeof config.baseURL}`,
      });
    } else if (!isValidUrl(config.baseURL)) {
      issues.push({
        field: `${pathPrefix}.baseURL`,
        message: `baseURL must be a valid URL starting with 'http://' or 'https://'. Received: '${config.baseURL}'`,
      });
    }
  }

  if (config.timeout !== undefined) {
    if (typeof config.timeout !== "number" || config.timeout <= 0) {
      issues.push({
        field: `${pathPrefix}.timeout`,
        message: `timeout must be a positive number in milliseconds. Received: ${config.timeout}`,
      });
    }
  }

  if (config.headers !== undefined) {
    if (typeof config.headers !== "object" || Array.isArray(config.headers)) {
      issues.push({
        field: `${pathPrefix}.headers`,
        message: `headers must be a plain object. Received: ${Array.isArray(config.headers) ? "array" : typeof config.headers}`,
      });
    }
  }

  return issues;
}

function validateHttpModuleOptions(
  opts: any,
  pathPrefix: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (opts === undefined || opts === null) {
    return issues;
  }

  if (typeof opts !== "object" || Array.isArray(opts)) {
    issues.push({
      field: pathPrefix,
      message: `must be an object. Received: ${Array.isArray(opts) ? "array" : typeof opts}`,
    });
    return issues;
  }

  if (opts.provide !== undefined && typeof opts.provide !== "string" && typeof opts.provide !== "symbol") {
    issues.push({
      field: `${pathPrefix}.provide`,
      message: `provide must be a string or symbol. Received: ${typeof opts.provide}`,
    });
  }

  if (opts.cacheToken !== undefined && typeof opts.cacheToken !== "string" && typeof opts.cacheToken !== "symbol") {
    issues.push({
      field: `${pathPrefix}.cacheToken`,
      message: `cacheToken must be a string or symbol. Received: ${typeof opts.cacheToken}`,
    });
  }

  if (opts.useCache !== undefined && typeof opts.useCache !== "boolean") {
    issues.push({
      field: `${pathPrefix}.useCache`,
      message: `useCache must be a boolean. Received: ${typeof opts.useCache}`,
    });
  }

  if (opts.logging !== undefined) {
    if (typeof opts.logging !== "object" || Array.isArray(opts.logging)) {
      issues.push({
        field: `${pathPrefix}.logging`,
        message: `logging must be an object. Received: ${Array.isArray(opts.logging) ? "array" : typeof opts.logging}`,
      });
    } else {
      if (opts.logging.enabled !== undefined && typeof opts.logging.enabled !== "boolean") {
        issues.push({
          field: `${pathPrefix}.logging.enabled`,
          message: `enabled must be a boolean. Received: ${typeof opts.logging.enabled}`,
        });
      }
      if (opts.logging.environments !== undefined && !Array.isArray(opts.logging.environments)) {
        issues.push({
          field: `${pathPrefix}.logging.environments`,
          message: `environments must be an array of strings. Received: ${typeof opts.logging.environments}`,
        });
      }
      if (opts.logging.types !== undefined && !Array.isArray(opts.logging.types)) {
        issues.push({
          field: `${pathPrefix}.logging.types`,
          message: `types must be an array of strings. Received: ${typeof opts.logging.types}`,
        });
      }
      if (opts.logging.includeHeaders !== undefined && typeof opts.logging.includeHeaders !== "boolean") {
        issues.push({
          field: `${pathPrefix}.logging.includeHeaders`,
          message: `includeHeaders must be a boolean. Received: ${typeof opts.logging.includeHeaders}`,
        });
      }
      if (opts.logging.includeBody !== undefined && typeof opts.logging.includeBody !== "boolean") {
        issues.push({
          field: `${pathPrefix}.logging.includeBody`,
          message: `includeBody must be a boolean. Received: ${typeof opts.logging.includeBody}`,
        });
      }
      if (opts.logging.requestId !== undefined) {
        if (typeof opts.logging.requestId !== "object" || Array.isArray(opts.logging.requestId)) {
          issues.push({
            field: `${pathPrefix}.logging.requestId`,
            message: `requestId must be an object. Received: ${Array.isArray(opts.logging.requestId) ? "array" : typeof opts.logging.requestId}`,
          });
        } else {
          if (opts.logging.requestId.autoGenerateIfMissing !== undefined && typeof opts.logging.requestId.autoGenerateIfMissing !== "boolean") {
            issues.push({
              field: `${pathPrefix}.logging.requestId.autoGenerateIfMissing`,
              message: `autoGenerateIfMissing must be a boolean. Received: ${typeof opts.logging.requestId.autoGenerateIfMissing}`,
            });
          }
          if (opts.logging.requestId.headerName !== undefined && typeof opts.logging.requestId.headerName !== "string") {
            issues.push({
              field: `${pathPrefix}.logging.requestId.headerName`,
              message: `headerName must be a string. Received: ${typeof opts.logging.requestId.headerName}`,
            });
          }
        }
      }
    }
  }

  if (opts.cache !== undefined) {
    if (typeof opts.cache !== "object" || Array.isArray(opts.cache)) {
      issues.push({
        field: `${pathPrefix}.cache`,
        message: `cache must be an object. Received: ${Array.isArray(opts.cache) ? "array" : typeof opts.cache}`,
      });
    } else {
      if (opts.cache.defaultTtl !== undefined && (typeof opts.cache.defaultTtl !== "number" || opts.cache.defaultTtl <= 0)) {
        issues.push({
          field: `${pathPrefix}.cache.defaultTtl`,
          message: `defaultTtl must be a positive number in milliseconds. Received: ${opts.cache.defaultTtl}`,
        });
      }
      if (opts.cache.keyPrefix !== undefined && typeof opts.cache.keyPrefix !== "string") {
        issues.push({
          field: `${pathPrefix}.cache.keyPrefix`,
          message: `keyPrefix must be a string. Received: ${typeof opts.cache.keyPrefix}`,
        });
      }
      if (opts.cache.redisOptions !== undefined && (typeof opts.cache.redisOptions !== "object" || Array.isArray(opts.cache.redisOptions))) {
        issues.push({
          field: `${pathPrefix}.cache.redisOptions`,
          message: `redisOptions must be an object. Received: ${Array.isArray(opts.cache.redisOptions) ? "array" : typeof opts.cache.redisOptions}`,
        });
      }
    }
  }

  return issues;
}

export function validateHttpForRoot(
  configOrOptions: any,
  options?: HttpModuleOptions,
): void {
  const issues: ValidationIssue[] = [];

  if (configOrOptions !== undefined && configOrOptions !== null) {
    if (typeof configOrOptions !== "object" || Array.isArray(configOrOptions)) {
      issues.push({
        field: "configOrOptions",
        message: `must be an object. Received: ${Array.isArray(configOrOptions) ? "array" : typeof configOrOptions}`,
      });
    } else if (looksLikeAxiosConfig(configOrOptions)) {
      issues.push(...validateAxiosConfig(configOrOptions, "config"));
      if (options !== undefined) {
        issues.push(...validateHttpModuleOptions(options, "options"));
      }
    } else {
      issues.push(...validateHttpModuleOptions(configOrOptions, "configOrOptions"));
      if (options !== undefined && Object.keys(options).length > 0) {
        issues.push({
          field: "options",
          message: `options should not be provided when the first argument is already HttpModuleOptions. Move all options into the first argument.`,
        });
      }
    }
  } else if (options !== undefined && Object.keys(options).length > 0) {
    issues.push(...validateHttpModuleOptions(options, "options"));
  }

  if (issues.length > 0) {
    const summary = issues.map((i) => `  - ${i.field}: ${i.message}`).join("\n");
    throw new HttpConfigError({
      message: `HttpModule.forRoot validation failed:\n${summary}`,
      status: 400,
      code: "HTTP_CONFIG_VALIDATION_ERROR",
      context: { issues },
    });
  }
}

export function validateHttpForRootAsync(options: {
  imports?: any[];
  useFactory: (...args: any[]) => any;
  inject?: any[];
  provide?: any;
  cacheToken?: any;
}): void {
  const issues: ValidationIssue[] = [];

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new HttpConfigError({
      message: `HttpModule.forRootAsync options must be an object. Received: ${Array.isArray(options) ? "array" : typeof options}`,
      status: 400,
      code: "HTTP_CONFIG_VALIDATION_ERROR",
    });
  }

  if (typeof options.useFactory !== "function") {
    issues.push({
      field: "useFactory",
      message: `useFactory is required and must be a function. Received: ${typeof options.useFactory}`,
    });
  }

  if (options.imports !== undefined && !Array.isArray(options.imports)) {
    issues.push({
      field: "imports",
      message: `imports must be an array of modules. Received: ${typeof options.imports}`,
    });
  }

  if (options.inject !== undefined && !Array.isArray(options.inject)) {
    issues.push({
      field: "inject",
      message: `inject must be an array of tokens. Received: ${typeof options.inject}`,
    });
  }

  if (options.provide !== undefined && typeof options.provide !== "string" && typeof options.provide !== "symbol") {
    issues.push({
      field: "provide",
      message: `provide must be a string or symbol. Received: ${typeof options.provide}`,
    });
  }

  if (options.cacheToken !== undefined && typeof options.cacheToken !== "string" && typeof options.cacheToken !== "symbol") {
    issues.push({
      field: "cacheToken",
      message: `cacheToken must be a string or symbol. Received: ${typeof options.cacheToken}`,
    });
  }

  if (issues.length > 0) {
    const summary = issues.map((i) => `  - ${i.field}: ${i.message}`).join("\n");
    throw new HttpConfigError({
      message: `HttpModule.forRootAsync validation failed:\n${summary}`,
      status: 400,
      code: "HTTP_CONFIG_VALIDATION_ERROR",
      context: { issues },
    });
  }
}
