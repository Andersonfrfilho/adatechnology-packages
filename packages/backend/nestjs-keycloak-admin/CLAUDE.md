# CLAUDE.md — @adatechnology/keycloak-admin

## Propósito

Cliente Keycloak Admin API para gerenciamento de usuários (criar, atualizar, resetar senha, habilitar/desabilitar, excluir). **Usado exclusivamente na API** — nunca no BFF.

## Uso

```ts
import { KeycloakAdminModule } from '@adatechnology/keycloak-admin';

KeycloakAdminModule.forRoot({
  realm: process.env.KEYCLOAK_REALM,
  authServerUrl: process.env.KEYCLOAK_URL,
  clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID,
  clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
})
```

## Token de Injeção

```ts
import { KEYCLOAK_ADMIN_PROVIDER } from '@adatechnology/keycloak-admin';
import type { KeycloakAdminClientInterface } from '@adatechnology/keycloak-admin';

constructor(
  @Inject(KEYCLOAK_ADMIN_PROVIDER)
  private readonly keycloakAdmin: KeycloakAdminClientInterface
) {}
```

## Interface do Client

```ts
interface KeycloakAdminClientInterface {
  createUser(params: CreateUserParams): Promise<string>;  // retorna keycloakId
  updateUser(params: UpdateUserParams): Promise<void>;
  resetPassword(params: ResetPasswordParams): Promise<void>;
  toggleUserEnabled(params: ToggleUserEnabledParams): Promise<void>;
  deleteUser(params: DeleteUserParams): Promise<void>;
  updateUserAttributes(params: UpdateUserAttributesParams): Promise<void>;
  sendVerifyEmail(params: SendVerifyEmailParams): Promise<void>;
}
```

## Logs automáticos

Com `enableTraceStack: true`, as operações aparecem na hierarquia:
```
[requestId][...][UserService.create][KeycloakAdminClient.createUser][INFO] - User created in Keycloak
```

## Responsabilidade

Esta lib só deve ser importada na **API** (`domestic-backend-api`). O BFF nunca gerencia usuários no Keycloak.
