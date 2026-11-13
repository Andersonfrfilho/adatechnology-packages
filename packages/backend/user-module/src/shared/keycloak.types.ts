/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Porta estreita de verificação de token — deliberadamente menor que `AuthProviderInterface`
 * (que emite sessão pronta): este módulo é quem decide find-or-create e assina o access token
 * pelo mesmo `TokenService` usado no login local, então só precisa das claims verificadas.
 */

export type KeycloakVerifierPort = {
  verify(accessToken: string): Promise<Record<string, unknown> | undefined>
}
