import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Inject,
} from '@nestjs/common';
import {
  getContext,
  LOGGER_PROVIDER,
  LoggerProviderInterface,
  runWithContext,
} from '@adatechnology/logger';
import { CACHE_PROVIDER } from '@adatechnology/cache';
import type { CacheProviderInterface } from '@adatechnology/cache';

@Controller('cache-demo')
export class CacheDemoController {
  constructor(
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProviderInterface,
    @Inject(LOGGER_PROVIDER) private readonly logger?: LoggerProviderInterface,
  ) {}

  /** Propagates logContext via AsyncLocalStorage so cache logs show the originating method */
  private withCtx<T>(logContext: object, fn: () => Promise<T>): Promise<T> {
    const currentContext = getContext();
    return runWithContext(
      currentContext ? { ...currentContext, logContext } : { logContext },
      fn,
    );
  }

  /**
   * GET /cache-demo/set?key=foo&value=bar&ttl=30
   * Stores a value in cache (plain, no encryption).
   */
  @Get('set')
  async set(
    @Query('key') key: string,
    @Query('value') value: string,
    @Query('ttl') ttl?: string,
  ) {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'set',
    };

    if (!key || !value) {
      return { error: 'query params key and value are required' };
    }

    const ttlSeconds = ttl ? Number(ttl) : undefined;

    this.logger?.info({
      message: 'Cache set start',
      context: CacheDemoController.name,
      meta: { key, ttlSeconds, logContext },
    });

    await this.withCtx(logContext, () =>
      this.cache.set({ key, value, ttlInSeconds: ttlSeconds }),
    );

    this.logger?.info({
      message: 'Cache set end',
      context: CacheDemoController.name,
      meta: { key, logContext },
    });

    return { ok: true, key, value, ttlSeconds: ttlSeconds ?? null };
  }

  /**
   * GET /cache-demo/get?key=foo
   * Retrieves a value from cache.
   */
  @Get('get')
  async get(@Query('key') key: string) {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'get',
    };

    if (!key) {
      return { error: 'query param key is required' };
    }

    this.logger?.info({
      message: 'Cache get start',
      context: CacheDemoController.name,
      meta: { key, logContext },
    });

    const value = await this.withCtx(logContext, () =>
      this.cache.get<unknown>({ key }),
    );

    this.logger?.info({
      message: 'Cache get end',
      context: CacheDemoController.name,
      meta: { key, hit: value !== null, logContext },
    });

    return { key, value, hit: value !== null };
  }

  /**
   * DELETE /cache-demo/del?key=foo
   * Removes a specific key from cache.
   */
  @Delete('del')
  async del(@Query('key') key: string) {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'del',
    };

    if (!key) {
      return { error: 'query param key is required' };
    }

    await this.withCtx(logContext, () => this.cache.del({ key }));

    return { deleted: key };
  }

  /**
   * POST /cache-demo/set-encrypted
   * Body: { key, value, ttl?, secret? }
   * Stores a value encrypted with AES-256-GCM.
   * If secret is omitted, uses the encryptionSecret from CacheModule.forRoot().
   */
  @Post('set-encrypted')
  async setEncrypted(
    @Body()
    body: {
      key: string;
      value: unknown;
      ttl?: number;
      secret?: string;
    },
  ) {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'setEncrypted',
    };
    const { key, value, ttl, secret } = body ?? {};

    if (!key || value === undefined) {
      return { error: 'body must contain key and value' };
    }

    this.logger?.info({
      message: 'Cache setEncrypted start',
      context: CacheDemoController.name,
      meta: { key, ttl, logContext },
    });

    await this.withCtx(logContext, () =>
      this.cache.setEncrypted({ key, value, ttlInSeconds: ttl, secret }),
    );

    this.logger?.info({
      message: 'Cache setEncrypted end',
      context: CacheDemoController.name,
      meta: { key, logContext },
    });

    return { ok: true, key, ttl: ttl ?? null };
  }

  /**
   * GET /cache-demo/get-encrypted?key=foo&secret=optional
   * Decrypts and retrieves a value stored with setEncrypted.
   */
  @Get('get-encrypted')
  async getEncrypted(
    @Query('key') key: string,
    @Query('secret') secret?: string,
  ) {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'getEncrypted',
    };

    if (!key) {
      return { error: 'query param key is required' };
    }

    this.logger?.info({
      message: 'Cache getEncrypted start',
      context: CacheDemoController.name,
      meta: { key, logContext },
    });

    const value = await this.withCtx(logContext, () =>
      this.cache.getEncrypted<unknown>({ key, secret }),
    );

    this.logger?.info({
      message: 'Cache getEncrypted end',
      context: CacheDemoController.name,
      meta: { key, hit: value !== null, logContext },
    });

    return { key, value, hit: value !== null };
  }

  /**
   * GET /cache-demo/demo
   * Full demonstration: set → get (hit) → del → get (miss).
   * Observe log cascade: CacheDemoController → InMemoryCacheProvider.
   */
  @Get('demo')
  async demo() {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'demo',
    };
    const key = 'demo:example-key';
    const value = { msg: 'hello from cache', ts: Date.now() };

    return this.withCtx(logContext, async () => {
      // miss
      const before = await this.cache.get({ key });

      // set with 60 s TTL
      await this.cache.set({ key, value, ttlInSeconds: 60 });

      // hit
      const after = await this.cache.get({ key });

      // del
      await this.cache.del({ key });

      // miss again
      const afterDel = await this.cache.get({ key });

      return {
        beforeSet: { hit: before !== null, value: before },
        afterSet: { hit: after !== null, value: after },
        afterDel: { hit: afterDel !== null, value: afterDel },
      };
    });
  }

  /**
   * GET /cache-demo/demo-encrypted
   * Full demonstration using AES-256-GCM encryption.
   * Requires encryptionSecret configured in CacheModule.forRoot().
   */
  @Get('demo-encrypted')
  async demoEncrypted() {
    const logContext = {
      className: CacheDemoController.name,
      methodName: 'demoEncrypted',
    };
    const key = 'demo:encrypted-key';
    const value = { secret: 'sensitive data', ts: Date.now() };

    return this.withCtx(logContext, async () => {
      await this.cache.setEncrypted({ key, value, ttlInSeconds: 60 });
      const retrieved = await this.cache.getEncrypted<typeof value>({ key });
      await this.cache.del({ key });

      return {
        stored: value,
        retrieved,
        match: JSON.stringify(value) === JSON.stringify(retrieved),
      };
    });
  }
}
