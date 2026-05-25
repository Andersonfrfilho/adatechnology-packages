# HTTP Provider

Este módulo fornece uma interface HTTP completa e flexível para fazer requisições HTTP em aplicações NestJS. Suporta tanto APIs Promise quanto Observable (RxJS), oferecendo máxima flexibilidade para diferentes casos de uso.

## Instalação

```bash
pnpm add -w axios rxjs
```

## Configuração

Configure o módulo no seu AppModule usando `forRoot` ou `forRootAsync`. O pacote publica o namespace `@adatechnology/http-client`.

```ts
import { Module } from "@nestjs/common";
import { HttpModule } from "@adatechnology/http-client";

@Module({
  imports: [
    HttpModule.forRoot({ 
      baseURL: "https://api.example.com", 
      timeout: 10000 
    }, {
      logging: {
        enabled: true,
        context: 'MyHttpClient',
        includeHeaders: true
      },
      useCache: true,
      cache: {
        defaultTtl: 60000 // 1 minuto
      }
    }),
  ],
})
export class AppModule {}
```

## Logging Padronizado

O `HttpModule` segue o padrão de logging do monorepo, permitindo rastreabilidade total entre camadas.

### Enviando Contexto de Origem
Para que o log mostre exatamente quem chamou o cliente HTTP, utilize a propriedade `logContext` na configuração da requisição:

```ts
await this.http.get({
  url: "/pokemon/1",
  config: {
    logContext: {
      className: "PokemonService",
      methodName: "findOne",
      requestId: "opcional-id-correlacao"
    }
  }
});
```

### Formato do Log Resultante
O log gerado seguirá o padrão:
`[App][@adatechnology/http-client:0.0.2][requestId][timestamp][PokemonService.findOne][MyHttpClient.get][INFO] - message - { meta }`

## Características

- ✅ Suporte completo a todos os métodos HTTP (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- ✅ APIs duplas: Promise e Observable (RxJS)
- ✅ Cache automático (em memória ou Redis)
- ✅ Interceptors globais e locais
- ✅ Logging estruturado com breadcrumbs de origem
- ✅ Injeção de dependência via tokens constantes (`HTTP_PROVIDER`)

## Interface Principal

```ts
interface HttpProviderInterface {
  get<T>(params: { url: string; config?: HttpRequestConfig }): Promise<HttpResponse<T>>;
  post<T>(params: { url: string; data?: any; config?: HttpRequestConfig }): Promise<HttpResponse<T>>;
  // ... outros métodos seguem o mesmo padrão de objeto de parâmetros
  
  setAuthToken(params: { token: string; type?: string }): void;
  clearAuthToken(): void;
  setBaseUrl(baseUrl: string): void;
}
```

Para mais detalhes sobre o padrão de logs, consulte o README do pacote `@adatechnology/logger`.
