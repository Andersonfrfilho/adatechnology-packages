import { Module } from '@nestjs/common';
import { CacheDemoController } from './cache-demo.controller';

/**
 * Demonstrates direct usage of @adatechnology/cache (CacheProviderInterface).
 * CacheModule.forRoot() is registered globally in AppModule, so CACHE_PROVIDER
 * is available here without re-importing CacheModule.
 */
@Module({
  controllers: [CacheDemoController],
})
export class CacheDemoModule {}
