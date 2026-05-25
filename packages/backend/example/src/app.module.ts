import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpClientModule } from './http-client/http-client.module';
import {
  KeycloakModule,
  KEYCLOAK_HTTP_INTERCEPTOR,
} from '@adatechnology/auth-keycloak';
import { CacheModule } from '@adatechnology/cache';
import { SecureModule } from './secure/secure.module';
import { KeycloakDemoModule } from './keycloak-demo/keycloak-demo.module';
import { CacheDemoModule } from './cache-demo/cache-demo.module';
import { HTTP_LOGGING_INTERCEPTOR, LoggerModule, RequestContextMiddleware } from '@adatechnology/logger';
import { HealthModule } from './health/health.module';
import { TracingDemoModule } from './tracing-demo/tracing-demo.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      level: 'debug',
      context: 'ExampleApp',
      appName: 'example',
      appVersion: '0.0.3',
      isProduction: process.env.NODE_ENV === 'production',
      colorize: true,
      enableTraceStack: true,
      fileTransport: {
        enabled: true,
        dir: 'logs',
        filename: 'example-%DATE%.log',
      },
    }),
    // registers CACHE_PROVIDER (InMemoryCacheProvider) globally
    // KeycloakModule will automatically use this cache for token storage
    CacheModule.forRoot({
      encryptionSecret: process.env.CACHE_ENCRYPTION_SECRET || 'example-secret-change-in-production',
    }),
    // example http-client demo module
    // demonstrates usage of the shared http-client package against jsonplaceholder
    HttpClientModule,
    // direct cache usage demo (GET/POST /cache-demo/*)
    CacheDemoModule,
    // example Keycloak infra (configured with example values)
    KeycloakModule.forRoot({
      // allow overriding the Keycloak URL/port via environment for local testing
      baseUrl:
        process.env.KEYCLOAK_BASE_URL ||
        `http://localhost:${process.env.KEYCLOAK_PORT || 9090}`,
      realm: process.env.KEYCLOAK_REALM || 'example',
      credentials: {
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'example-client',
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
        // ensure grantType matches the expected literal union
        grantType:
          process.env.KEYCLOAK_GRANT_TYPE === 'password'
            ? 'password'
            : 'client_credentials',
      },
    }),
    // demo module that exposes endpoints to exercise KeycloakClient
    // (GET /keycloak/token, POST /keycloak/login, GET /keycloak/validate, etc.)
    KeycloakDemoModule,
    // secure demo that shows role-based decorators & guard
    SecureModule,
    // tracing demo: test the configurable tracing architecture
    // (GET /tracing/status, GET /tracing/order/:orderId, GET /tracing/test-empty-stack)
    TracingDemoModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // log every HTTP request/response (method, path, headers, body, statusCode, durationMs)
    { provide: APP_INTERCEPTOR, useExisting: HTTP_LOGGING_INTERCEPTOR },
    // register the Keycloak HTTP interceptor as a global interceptor (useExisting to reuse provider from KeycloakModule)
    { provide: APP_INTERCEPTOR, useExisting: KEYCLOAK_HTTP_INTERCEPTOR },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
