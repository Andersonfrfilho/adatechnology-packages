/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { z } from 'zod'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

export const localCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  /** Ausente = comportamento de sempre; `false` = cookie de sessão; `true` = cookie persistente longo. */
  rememberMe: z.boolean().optional(),
})

export type LocalCredentials = z.infer<typeof localCredentialsSchema>

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
})

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>

export const confirmPasswordResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
})

export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(255),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  role: z.string().min(1).max(40),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

/** Senha definida pelo administrador para outra pessoa. Mesmas regras do cadastro. */
export const setUserPasswordSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
})

export type SetUserPasswordInput = z.infer<typeof setUserPasswordSchema>

/**
 * `accessToken`, não `code`/`state`: o módulo verifica localmente um token já emitido pelo
 * Keycloak (`@adatechnology/auth-keycloak`, verificação via JWKS) — a troca do `code` da
 * authorization code flow é responsabilidade do host/frontend, antes de chegar aqui.
 */
export const keycloakCallbackSchema = z.object({
  accessToken: z.string().min(1),
})

export type KeycloakCallbackInput = z.infer<typeof keycloakCallbackSchema>

/** Cadastro público: sem `role` — o papel é decidido pela configuração do host (`SignUpConfig`). */
export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(255),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
})

export type SignUpInput = z.infer<typeof signUpSchema>

/**
 * Atualização administrativa. Só papel e situação: o módulo nunca apaga usuário, desativa.
 * `unlock` limpa o bloqueio por tentativas falhas sem mexer no resto.
 */
export const updateUserSchema = z
  .object({
    role: z.string().min(1).max(40).optional(),
    isActive: z.boolean().optional(),
    unlock: z.literal(true).optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined || value.unlock === true, {
    message: 'Informe role, isActive ou unlock',
  })

export type UpdateUserInput = z.infer<typeof updateUserSchema>

/** Troca de senha pela própria pessoa: a senha atual é sempre exigida. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newEmail: z.string().trim().toLowerCase().email().max(320),
})

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>

export const confirmEmailChangeSchema = z.object({ token: z.string().min(1).max(200) })

export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>

export const changePhoneSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  phone: z.string().trim().min(5).max(30),
})

export type ChangePhoneInput = z.infer<typeof changePhoneSchema>

export const verifyPhoneSchema = z.object({ code: z.string().trim().min(4).max(10) })

export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>

/** Recuperação assistida pela equipe: e-mail novo (com link de nova senha) e/ou destravar. */
export const recoverAccountSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320).optional(),
    unlock: z.literal(true).optional(),
  })
  .refine((value) => value.email !== undefined || value.unlock === true, { message: 'Informe email ou unlock' })

export type RecoverAccountInput = z.infer<typeof recoverAccountSchema>
