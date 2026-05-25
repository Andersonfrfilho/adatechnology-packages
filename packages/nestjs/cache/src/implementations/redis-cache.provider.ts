import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { getContext, LoggerProviderInterface } from "@adatechnology/logger";
import Redis, { RedisOptions } from "ioredis";

import {
  CacheProviderInterface,
  DelParams,
  GetEncryptedParams,
  GetParams,
  SetEncryptedParams,
  SetParams,
} from "../cache.interface";
import { LIB_NAME, LIB_VERSION } from "../cache.constants";
import { decrypt, encrypt } from "../crypto.utils";

@Injectable()
export class RedisCacheProvider
  implements CacheProviderInterface, OnModuleDestroy
{
  private readonly className = this.constructor.name;
  private readonly redis: Redis;

  constructor(
    options: RedisOptions,
    private readonly logger?: LoggerProviderInterface,
    private readonly encryptionSecret?: string,
  ) {
    this.redis = new Redis(options);
  }

  private callerLogContext(): Record<string, unknown> | undefined {
    const ctx = getContext();
    return ctx?.logContext as Record<string, unknown> | undefined;
  }

  async get<T>({ key }: GetParams): Promise<T | null> {
    const libMethod = `${this.className}.get`;
    const value = await this.redis.get(key);

    if (!value) {
      this.logger?.debug?.({
        message: `Cache miss: ${key}`,
        context: this.className,
        meta: {
          key,
          hit: false,
          lib: LIB_NAME,
          libVersion: LIB_VERSION,
          libMethod,
          logContext: this.callerLogContext(),
        },
      });
      return null;
    }

    this.logger?.debug?.({
      message: `Cache hit: ${key}`,
      context: this.className,
      meta: {
        key,
        hit: true,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod,
        logContext: this.callerLogContext(),
      },
    });
    return JSON.parse(value) as T;
  }

  async set<T>({ key, value, ttlInSeconds }: SetParams<T>): Promise<void> {
    const libMethod = `${this.className}.set`;
    const stringifiedValue = JSON.stringify(value);

    if (ttlInSeconds) {
      await this.redis.set(key, stringifiedValue, "EX", ttlInSeconds);
    } else {
      await this.redis.set(key, stringifiedValue);
    }

    this.logger?.debug?.({
      message: `Cache set: ${key}`,
      context: this.className,
      meta: {
        key,
        ttlInSeconds: ttlInSeconds ?? null,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod,
        logContext: this.callerLogContext(),
      },
    });
  }

  async del({ key }: DelParams): Promise<void> {
    const libMethod = `${this.className}.del`;
    await this.redis.del(key);
    this.logger?.debug?.({
      message: `Cache del: ${key}`,
      context: this.className,
      meta: {
        key,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod,
        logContext: this.callerLogContext(),
      },
    });
  }

  async clear(): Promise<void> {
    const libMethod = `${this.className}.clear`;
    await this.redis.flushall();
    this.logger?.info?.({
      message: "Cache cleared (flushall)",
      context: this.className,
      meta: {
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod,
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
    const libMethod = `${this.className}.setEncrypted`;
    const resolvedSecret = secret ?? this.encryptionSecret;

    if (!resolvedSecret) {
      throw new Error(
        `[${LIB_NAME}] setEncrypted: no encryption secret provided. Pass a secret or set encryptionSecret in the constructor.`,
      );
    }

    const ciphertext = encrypt({
      plaintext: JSON.stringify(value),
      secret: resolvedSecret,
    });

    if (ttlInSeconds) {
      await this.redis.set(key, ciphertext, "EX", ttlInSeconds);
    } else {
      await this.redis.set(key, ciphertext);
    }

    this.logger?.debug?.({
      message: `Cache setEncrypted: ${key}`,
      context: this.className,
      meta: {
        key,
        ttlInSeconds: ttlInSeconds ?? null,
        lib: LIB_NAME,
        libVersion: LIB_VERSION,
        libMethod,
        logContext: this.callerLogContext(),
      },
    });
  }

  async getEncrypted<T>({
    key,
    secret,
  }: GetEncryptedParams): Promise<T | null> {
    const libMethod = `${this.className}.getEncrypted`;
    const resolvedSecret = secret ?? this.encryptionSecret;

    if (!resolvedSecret) {
      throw new Error(
        `[${LIB_NAME}] getEncrypted: no encryption secret provided. Pass a secret or set encryptionSecret in the constructor.`,
      );
    }

    const ciphertext = await this.redis.get(key);

    if (!ciphertext) {
      this.logger?.debug?.({
        message: `Cache miss (encrypted): ${key}`,
        context: this.className,
        meta: {
          key,
          hit: false,
          lib: LIB_NAME,
          libVersion: LIB_VERSION,
          libMethod,
          logContext: this.callerLogContext(),
        },
      });
      return null;
    }

    try {
      const plaintext = decrypt({
        encoded: ciphertext,
        secret: resolvedSecret,
      });
      this.logger?.debug?.({
        message: `Cache hit (encrypted): ${key}`,
        context: this.className,
        meta: {
          key,
          hit: true,
          lib: LIB_NAME,
          libVersion: LIB_VERSION,
          libMethod,
          logContext: this.callerLogContext(),
        },
      });
      return JSON.parse(plaintext) as T;
    } catch {
      this.logger?.warn?.({
        message: `Cache decryption failed: ${key}`,
        context: this.className,
        meta: {
          key,
          lib: LIB_NAME,
          libVersion: LIB_VERSION,
          libMethod,
          logContext: this.callerLogContext(),
        },
      });
      return null;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
