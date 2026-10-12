/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type VerifyAdminPasswordParams = {
  readonly agentId: string
  readonly password: string
}

export type VerifyAdminPasswordResult =
  | { readonly outcome: 'confirmed' }
  | { readonly outcome: 'invalid' }
  | { readonly outcome: 'locked'; readonly retryAfterSeconds: number; readonly isNewLock: boolean }

/** Porta do host: confere a senha do administrador relida no banco, com o bloqueio por falhas. */
export interface InfraPasswordVerifierInterface {
  execute(params: VerifyAdminPasswordParams): Promise<VerifyAdminPasswordResult>
}
