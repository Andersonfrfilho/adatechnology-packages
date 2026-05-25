import { Module } from '@nestjs/common';
import { HttpClientController } from './http-client.controller';
import {
  HttpModule,
  HttpRequestIdInterceptor,
} from '@adatechnology/http-client';
import { HTTP_REDIS, HTTP_LOCAL } from '../constants';

@Module({
  imports: [
    // Instância 1: PokeAPI com Cache Redis (Configuração Async)
    HttpModule.forRootAsync({
      provide: HTTP_REDIS, // Token customizado
      useFactory: () => ({
        config: { baseURL: 'https://pokeapi.co/api/v2', timeout: 5000 },
        options: {
          useCache: true,
          cache: {
            defaultTtl: 60000,
            redisOptions: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
            },
          },
          logging: {
            enabled: true,
            context: 'HttpRedisClient',
            includeHeaders: true,
            includeBody: true,
            // ensure requestId header handling
            requestId: {
              headerName: 'x-request-id',
              autoGenerateIfMissing: true,
            },
          },
        },
      }),
    }),

    // Instância 2: JSONPlaceholder com Cache Local (Configuração Estática)
    HttpModule.forRoot(
      { baseURL: 'https://jsonplaceholder.typicode.com', timeout: 5000 },
      {
        provide: HTTP_LOCAL, // Outro token customizado
        useCache: true,
        logging: {
          enabled: true,
          context: 'HttpLocalClient',
          includeHeaders: true,
          includeBody: true,
          requestId: {
            headerName: 'x-request-id',
            autoGenerateIfMissing: true,
          },
        },
      },
    ),
  ],
  controllers: [HttpClientController],
  providers: [HttpRequestIdInterceptor],
})
export class HttpClientModule {}
