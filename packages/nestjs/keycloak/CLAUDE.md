# CLAUDE.md — @adatechnology/auth-keycloak

## Propósito

Auth guard para NestJS usando Keycloak como provedor OAuth2/OIDC. Valida JWT via token introspection.

## Uso

```ts
import { KeycloakModule } from '@adatechnology/auth-keycloak';

KeycloakModule.forRoot({
  realm: process.env.KEYCLOAK_REALM,
  authServerUrl: process.env.KEYCLOAK_URL,
  clientId: process.env.KEYCLOAK_CLIENT_ID,
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
})
```

## Guards

```ts
import { ApiAuthGuard, B2BGuard } from '@adatechnology/auth-keycloak';

// Para rotas de usuário final (JWT de browser/app)
@UseGuards(ApiAuthGuard)
@Get('profile')
async getProfile() { ... }

// Para comunicação B2B (client credentials)
@UseGuards(B2BGuard)
@Post('webhook')
async handleWebhook() { ... }
```

## Decorator @AuthUser()

Injeta o usuário decodificado do token JWT:

```ts
import { AuthUser } from '@adatechnology/auth-keycloak';
import type { KeycloakTokenPayload } from '@adatechnology/auth-keycloak';

@Get('me')
@UseGuards(ApiAuthGuard)
async getMe(@AuthUser() user: KeycloakTokenPayload) {
  return { keycloakId: user.sub, email: user.email };
}
```

## Logs automáticos

A lib usa `lib: '@adatechnology/auth-keycloak'` no logger. Com `enableTraceStack: true`, aparece na hierarquia:
```
[requestId][...][UserController.getMe][ApiAuthGuard.canActivate][INFO] - Token validated
```

## Responsabilidade da API vs BFF

- **API**: única responsável por criar/gerenciar usuários no Keycloak
- **BFF**: NUNCA chama Keycloak diretamente — apenas consome dados da API
