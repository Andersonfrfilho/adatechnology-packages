# CLAUDE.md — @adatechnology/http-client

## Propósito

Cliente HTTP baseado em Axios com logging estruturado automático, propagação de requestId e integração com TraceStack.

## Uso

```ts
import { HttpClientModule } from '@adatechnology/http-client';

HttpClientModule.forRoot({
  baseURL: process.env.API_BASE_URL,
  timeout: 5000,
})
```

## Token de Injeção

```ts
import { HTTP_CLIENT_PROVIDER } from '@adatechnology/http-client';

constructor(@Inject(HTTP_CLIENT_PROVIDER) private readonly http: HttpClientInterface) {}
```

## Interface do Client

```ts
interface HttpClientInterface {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
}
```

## Logs automáticos

Cada request loga:
- `INFO` — ao iniciar (url, method)
- `INFO` — ao completar (status, duration_ms)
- `ERROR` — em caso de falha (status, error)

Aparece no traceStack com `lib: '@adatechnology/http-client'` quando `enableTraceStack: true`:
```
[requestId][...][Service.doSomething][HttpClient.post][INFO] - POST /api/endpoint
```

## Propagação de requestId

O cliente propaga automaticamente o `X-Request-Id` header a partir do ALS context, correlacionando requests inter-serviços.
