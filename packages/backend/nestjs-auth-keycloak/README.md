## @adatechnology/auth-keycloak

Módulo Keycloak para autenticação de clients e usuários, seguindo o padrão do `HttpModule` do monorepo.

Este pacote fornece um cliente leve para interagir com o Keycloak (obter/refresh de tokens, introspecção, userinfo)
e um interceptor opcional. O módulo foi projetado para ser usado junto ao `@adatechnology/http-client`.

### Principais exportações

- `KeycloakModule` — módulo principal. Suporta `KeycloakModule.forRoot(config?)`.
- `KEYCLOAK_CLIENT` — provider token para injetar o cliente Keycloak (`@Inject(KEYCLOAK_CLIENT)`).
- `KEYCLOAK_HTTP_INTERCEPTOR` — provider token para injetar o interceptor (opcional).
- `BearerTokenGuard` — guard que valida o token Bearer via introspecção no Keycloak (401 em falha).
- `Roles` / `RolesGuard` — decorator e guard para autorização baseada em roles (403 em falha).
- `KeycloakError` — classe de erro tipada com `statusCode` e `details`.

### Instalação

```bash
# Este pacote já declara dependências de workspace para http-client, logger e cache.
# Em um monorepo PNPM/Turbo os pacotes são resolvidos automaticamente.
```

### Uso básico

```ts
import { Module } from "@nestjs/common";
import { KeycloakModule } from "@adatechnology/auth-keycloak";

@Module({
  imports: [
    KeycloakModule.forRoot({
      baseUrl: "https://keycloak.example.com",
      realm: "myrealm",
      credentials: {
        clientId: "my-client",
        clientSecret: "my-secret",
        grantType: "client_credentials",
      },
    }),
  ],
})
export class AppModule {}
```

### Injeção do cliente

```ts
import { Inject } from '@nestjs/common';
import { KEYCLOAK_CLIENT } from '@adatechnology/auth-keycloak';
import type { KeycloakClientInterface } from '@adatechnology/auth-keycloak';

constructor(
  @Inject(KEYCLOAK_CLIENT) private readonly keycloakClient: KeycloakClientInterface,
) {}
```

### API do cliente

| Método | Descrição |
|---|---|
| `getAccessToken()` | Obtém token com cache automático e deduplicação de requisições |
| `getTokenWithCredentials({ username, password })` | Login com credenciais (resource-owner password grant) |
| `refreshToken(refreshToken)` | Renova token e atualiza o cache interno |
| `validateToken(token)` | Introspecção via endpoint `/token/introspect` |
| `getUserInfo(token)` | Retorna claims via endpoint `/userinfo` |
| `clearTokenCache()` | Remove o token do cache (útil para forçar renovação) |

### Cache de token

O `KeycloakClient` usa `@adatechnology/cache` para armazenar o access token obtido via `client_credentials`.
Por padrão é criado um `InMemoryCacheProvider` local. Você pode substituir por Redis ou qualquer implementação
de `CacheProviderInterface` injetando o provider `CACHE_PROVIDER` no contexto do módulo:

```ts
import { Module } from "@nestjs/common";
import { CacheModule } from "@adatechnology/cache";
import { KeycloakModule } from "@adatechnology/auth-keycloak";

@Module({
  imports: [
    // Registra CACHE_PROVIDER como Redis — KeycloakClient o usará automaticamente
    CacheModule.forRoot({
      type: 'redis',
      redis: { host: 'localhost', port: 6379 },
    }),
    KeycloakModule.forRoot({ ... }),
  ],
})
export class AppModule {}
```

Se `CACHE_PROVIDER` não for registrado no módulo, o `KeycloakClient` cria um `InMemoryCacheProvider`
interno sem necessidade de configuração adicional.

O TTL do cache é derivado do campo `expires_in` do token (com 60 segundos de margem). Você pode
sobrescrever com a opção `tokenCacheTtl` (em **milissegundos**):

```ts
KeycloakModule.forRoot({
  ...
  tokenCacheTtl: 60_000, // força TTL de 60 s independente do token
})
```

### Propagação de contexto de log (cascade)

O cliente lê o `logContext` do `AsyncLocalStorage` da lib `@adatechnology/logger`. Para que os logs
de downstream (keycloak → cache) mostrem `className.methodName` da origem correta, use `runWithContext`
no controller:

```ts
import { getContext, runWithContext } from '@adatechnology/logger';

// No controller
private withCtx<T>(logContext: object, fn: () => Promise<T>): Promise<T> {
  return runWithContext({ ...(getContext() ?? {}), logContext }, fn);
}

async getToken() {
  const logContext = { className: 'MyController', methodName: 'getToken' };
  return this.withCtx(logContext, () => this.keycloakService.getAccessToken());
}
```

Resultado no log:
```
[MyController.getToken][KeycloakClient.getAccessToken] → cache miss → request token
[MyController.getToken][InMemoryCacheProvider.set] → token cached
```

### Contrato de headers (Kong → API)

```
Authorization: Bearer <service_token>   → identidade do chamador (B2B)
X-Access-Token: <user_jwt>              → token original do usuário (B2C)
```

Kong valida o JWT do usuário via JWKS (local, zero chamadas ao Keycloak por request) e injeta os dois headers antes de encaminhar a request ao API.

---

### Guards

| Guard | Valida | Quando usar |
|---|---|---|
| `B2CGuard` | `X-Access-Token` presente | Rota exclusiva de usuários via Kong |
| `B2BGuard` | `Authorization` via introspection | Rota exclusiva de serviços internos |
| `ApiAuthGuard` | Detecta path e delega | Rota acessível pelos dois paths |
| `RolesGuard` | Roles no JWT correto | Sempre junto a um guard acima |
| `BearerTokenGuard` | `Authorization` via introspection | Nível baixo; prefira `B2BGuard` |

**Guard order matters** — guards de autenticação devem vir antes de `RolesGuard`.

---

### Decorators

#### `@AuthUser(param?)`
Extrai claim do token em `X-Access-Token`. Padrão: claim configurado em `userId` (default `sub`). Decodificação local, sem I/O.

```ts
@AuthUser()                                           // sub (default)
@AuthUser('email')                                    // claim único
@AuthUser(['preferred_username', 'email', 'sub'])     // primeiro não-vazio
@AuthUser({ claim: 'email', header: 'x-user-jwt' }) // header customizado por rota
```

#### `@CallerToken(param?)`
Extrai claim do token em `Authorization`. Padrão: claim configurado em `callerId` (default `azp`).

```ts
@CallerToken()                                              // azp (default)
@CallerToken('sub')                                         // claim único
@CallerToken(['client_id', 'azp'])                          // primeiro não-vazio
@CallerToken({ header: 'x-service-token', claim: 'azp' }) // header customizado
```

#### `@AccessToken(header?)`
Retorna o JWT bruto do header B2C. Use quando precisar de claims não-string ou repassar o token.

```ts
@AccessToken()              // header B2C padrão
@AccessToken('x-user-jwt')  // header customizado
```

#### `@Roles(...)`
Declara roles necessárias. Sempre usado com `RolesGuard`.

```ts
@Roles('user-manager')
@Roles({ roles: ['admin', 'user-manager'], mode: 'any' })  // qualquer (default)
@Roles({ roles: ['admin', 'user-manager'], mode: 'all' })  // todas
```

---

### Exemplos de uso

**B2C — usuário via Kong:**
```ts
@Get('me')
@Roles('user-manager')
@UseGuards(B2CGuard, RolesGuard)
async getMe(
  @AuthUser() id: string,
  @AuthUser('email') email: string,
  @AuthUser(['preferred_username', 'email']) name: string,
  @AccessToken() rawToken: string,
) {
  return { id, email, name };
}
```

**B2B — serviço interno:**
```ts
@Post('internal/notify')
@Roles('send-notifications')
@UseGuards(B2BGuard, RolesGuard)
async notify(
  @CallerToken() caller: string,  // 'domestic-backend-bff'
) {
  return { caller };
}
```

**Ambos os paths:**
```ts
@Get(':id')
@Roles('user-manager')
@UseGuards(ApiAuthGuard, RolesGuard)
async findById(
  @Param('id') id: string,
  @AuthUser() userId: string,    // vazio no B2B-only path
  @CallerToken() caller: string,
) { ... }
```

---

### Configuração de headers e claims

Configurável via env ou `forRoot()`. Prioridade: `forRoot()` > `process.env` > default.

**Env vars:**
```env
KEYCLOAK_B2C_TOKEN_HEADER=x-access-token        # header do user JWT
KEYCLOAK_B2B_TOKEN_HEADER=authorization         # header do service token
KEYCLOAK_USER_ID_CLAIM=sub                      # claim(s) para user ID (comma-separated)
KEYCLOAK_CALLER_ID_CLAIM=azp                    # claim(s) para caller ID (comma-separated)
```

**`forRoot()` (sobrescreve env):**
```ts
KeycloakModule.forRoot({
  ...
  headers: { b2cToken: 'x-access-token', b2bToken: 'authorization' },
  claims: {
    userId: ['preferred_username', 'email', 'sub'],  // string ou string[]
    callerId: ['client_id', 'azp'],
  },
})
```

---

### BearerTokenGuard — autenticação B2B via introspecção

Valida `Authorization: Bearer <token>` chamando `POST /token/introspect` no Keycloak.

| Guard | Mecanismo | HTTP? | Falha |
|---|---|---|---|
| `BearerTokenGuard` | `POST /token/introspect` | Sim | 401 |
| `RolesGuard` | Decode local do payload | Não | 403 |

O `RolesGuard` sozinho **não é seguro** — ele decodifica sem verificar assinatura.

---

### Tratamento de erros

```ts
import { KeycloakError } from "@adatechnology/auth-keycloak";

try {
  await keycloakClient.getUserInfo(token);
} catch (e) {
  if (e instanceof KeycloakError) {
    console.error(e.statusCode, e.details, e.keycloakError);
  }
  throw e;
}
```

### Variáveis de ambiente (referência)

| Variável | Padrão |
|---|---|
| `KEYCLOAK_BASE_URL` | `http://localhost:8081` |
| `KEYCLOAK_REALM` | `BACKEND` |
| `KEYCLOAK_CLIENT_ID` | `backend-api` |
| `KEYCLOAK_CLIENT_SECRET` | `backend-api-secret` |
| `KEYCLOAK_B2C_TOKEN_HEADER` | `x-access-token` |
| `KEYCLOAK_B2B_TOKEN_HEADER` | `authorization` |
| `KEYCLOAK_USER_ID_CLAIM` | `sub` |
| `KEYCLOAK_CALLER_ID_CLAIM` | `azp` |

### Notas

- Este módulo depende de `@adatechnology/http-client` para chamadas HTTP ao Keycloak.
- O interceptor `KeycloakHttpInterceptor` pode ser registrado como `APP_INTERCEPTOR` para integração global.
- `clearTokenCache()` é assíncrono desde a versão `0.0.7` (retorna `Promise<void>`).

### Contribuições

Relate issues/PRs no repositório principal. Mantenha compatibilidade com o padrão usado pelo `HttpModule`.

### Licença

MIT
