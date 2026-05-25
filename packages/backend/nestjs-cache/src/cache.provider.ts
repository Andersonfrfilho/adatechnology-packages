import { CACHE_PROVIDER } from './cache.token';
import { InMemoryCacheProvider } from './implementations/in-memory-cache.provider';

export const cacheProviders = [
  {
    provide: CACHE_PROVIDER,
    useClass: InMemoryCacheProvider,
  },
];
