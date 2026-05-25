import { Global, Module, DynamicModule } from '@nestjs/common';

import { cacheProviders } from './cache.provider';
import { CACHE_ENCRYPTION_SECRET, CACHE_MODULE_OPTIONS, CACHE_PROVIDER } from './cache.token';
import { validateCacheConfig } from './validators/validate-cache-config';

export interface CacheModuleOptions {
  isGlobal?: boolean;
  /**
   * Secret usado por `setEncrypted` / `getEncrypted`.
   * Deve ter pelo menos 16 caracteres. Se omitido, as chamadas de criptografia
   * lançarão um erro explícito pedindo o secret.
   */
  encryptionSecret?: string;

  /**
   * Padrões de chave a serem excluídos dos logs de debug.
   * Similar a `interceptorExcludedPaths` do LoggerModule.
   * Exemplo: ['health:*', 'metrics:*']
   */
  excludedDebugKeys?: string[];
}

@Global()
@Module({})
export class CacheModule {
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    validateCacheConfig(options);

    const secretProvider = {
      provide: CACHE_ENCRYPTION_SECRET,
      useValue: options.encryptionSecret ?? null,
    };

    const optionsProvider = {
      provide: CACHE_MODULE_OPTIONS,
      useValue: options,
    };

    return {
      module: CacheModule,
      global: options.isGlobal ?? true,
      providers: [...cacheProviders, secretProvider, optionsProvider],
      exports: [CACHE_PROVIDER, CACHE_ENCRYPTION_SECRET, CACHE_MODULE_OPTIONS],
    };
  }
}
