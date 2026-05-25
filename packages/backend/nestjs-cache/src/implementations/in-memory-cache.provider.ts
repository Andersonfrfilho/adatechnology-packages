import { Inject, Injectable, Optional } from "@nestjs/common";
import type { CacheModuleOptions } from "../cache.module";
import { getContext, LOGGER_PROVIDER } from "@adatechnology/logger";
import type { LoggerProviderInterface } from "@adatechnology/logger";

import {
  CacheProviderInterface,
  DelParams,
  GetEncryptedParams,
  GetParams,
  SetEncryptedParams,
  SetParams,
} from "../cache.interface";
import { CACHE_ENCRYPTION_SECRET, CACHE_MODULE_OPTIONS } from "../cache.token";
import { LIB_NAME, LIB_VERSION } from "../cache.constants";
import { decrypt, encrypt } from "../crypto.utils";

@Injectable()
export class InMemoryCacheProvider implements CacheProviderInterface {
  private readonly className = this.constructor.name;
  private readonly excludedDebugKeys: RegExp[];
  private readonly cache = new Map<
    string,
    { value: any; expiry: number | null }
  >();

  constructor(
    @Optional()
    @Inject(LOGGER_PROVIDER)
    private readonly logger?: LoggerProviderInterface,
    @Optional()
    @Inject(CACHE_ENCRYPTION_SECRET)
    private readonly encryptionSecret?: string | null,
    @Optional()
    @Inject(CACHE_MODULE_OPTIONS)
    private readonly moduleOptions?: CacheModuleOptions,
  ) {
    this.excludedDebugKeys =
      moduleOptions?.excludedDebugKeys?.map(
        (pattern) => new RegExp("^" + pattern.replace(/\*/g, ".*") + "$"),
      ) ?? [];
  }

  private isDebugExcluded(key: string): boolean {
    return this.excludedDebugKeys.some((re) => re.test(key));
  }

  private callerLogContext(): Record<string, unknown> | undefined {
    const ctx = getContext();
    return ctx?.logContext as Record<string, unknown> | undefined;
  }

  private logDebug(
    method: string,
    message: string,
    key: string,
    extra: Record<string, unknown> = {},
  ): void {
    if (this.isDebugExcluded(key)) return;
    this.logger?.debug?.({
      message,
      context: this.className,
      lib: LIB_NAME,
      libVersion: LIB_VERSION,
      libMethod: method,
      meta: {
        key,
        logContext: this.callerLogContext(),
        ...extra,
      },
    });
  }

  async get<T>({ key }: GetParams): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.logDebug("get", `Cache miss: ${key}`, key, { hit: false });
      return null;
    }

    if (entry.expiry && Date.now() > entry.expiry) {
      this.logDebug("get", `Cache expired: ${key}`, key, {
        hit: false,
        expired: true,
      });
      this.cache.delete(key);
      return null;
    }

    this.logDebug("get", `Cache hit: ${key}`, key, { hit: true });
    return entry.value as T;
  }

  async set<T>({ key, value, ttlInSeconds }: SetParams<T>): Promise<void> {
    const expiry = ttlInSeconds ? Date.now() + ttlInSeconds * 1000 : null;
    this.cache.set(key, { value, expiry });
    this.logDebug("set", `Cache set: ${key}`, key, {
      ttlInSeconds: ttlInSeconds ?? null,
    });
  }

  async del({ key }: DelParams): Promise<void> {
    this.cache.delete(key);
    this.logDebug("del", `Cache del: ${key}`, key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger?.info?.({
      message: "Cache cleared (all keys)",
      context: this.className,
      lib: LIB_NAME,
      libVersion: LIB_VERSION,
      libMethod: "clear",
      meta: {
        logContext: this.callerLogContext(),
      },
    });
  }

  async setEncrypted<T>({
    key,
    value,
    ttlInSeconds,
    secret,
  }: SetEncryptedParams<T>): Promise<void> {
    const resolvedSecret = secret ?? this.encryptionSecret;

    if (!resolvedSecret) {
      throw new Error(
        `[${LIB_NAME}] setEncrypted: no encryption secret provided. Pass a secret or configure encryptionSecret in CacheModule.forRoot().`,
      );
    }

    const ciphertext = encrypt({
      plaintext: JSON.stringify(value),
      secret: resolvedSecret,
    });
    const expiry = ttlInSeconds ? Date.now() + ttlInSeconds * 1000 : null;
    this.cache.set(key, { value: ciphertext, expiry });

    this.logger?.debug?.({
      message: `Cache setEncrypted: ${key}`,
      context: this.className,
      lib: LIB_NAME,
      libVersion: LIB_VERSION,
      libMethod: "setEncrypted",
      meta: {
        key,
        ttlInSeconds: ttlInSeconds ?? null,
        logContext: this.callerLogContext(),
      },
    });
  }

  async getEncrypted<T>({
    key,
    secret,
  }: GetEncryptedParams): Promise<T | null> {
    const resolvedSecret = secret ?? this.encryptionSecret;

    if (!resolvedSecret) {
      throw new Error(
        `[${LIB_NAME}] getEncrypted: no encryption secret provided. Pass a secret or configure encryptionSecret in CacheModule.forRoot().`,
      );
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.logger?.debug?.({
        message: `Cache miss (encrypted): ${key}`,
        context: this.className,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod: "getEncrypted",
        meta: {
          key,
          hit: false,
          logContext: this.callerLogContext(),
        },
      });
      return null;
    }

    if (entry.expiry && Date.now() > entry.expiry) {
      this.logger?.debug?.({
        message: `Cache expired (encrypted): ${key}`,
        context: this.className,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod: "getEncrypted",
        meta: {
          key,
          hit: false,
          expired: true,
          logContext: this.callerLogContext(),
        },
      });
      this.cache.delete(key);
      return null;
    }

    try {
      const plaintext = decrypt({
        encoded: entry.value as string,
        secret: resolvedSecret,
      });
      this.logger?.debug?.({
        message: `Cache hit (encrypted): ${key}`,
        context: this.className,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod: "getEncrypted",
        meta: {
          key,
          hit: true,
          logContext: this.callerLogContext(),
        },
      });
      return JSON.parse(plaintext) as T;
    } catch {
      this.logger?.warn?.({
        message: `Cache decryption failed: ${key}`,
        context: this.className,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod: "getEncrypted",
        meta: {
          key,
          logContext: this.callerLogContext(),
        },
      });
      return null;
    }
  }
}
