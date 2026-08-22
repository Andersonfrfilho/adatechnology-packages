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

/**
 * `accessToken`, não `code`/`state`: o módulo verifica localmente um token já emitido pelo
 * Keycloak (`@adatechnology/auth-keycloak`, verificação via JWKS) — a troca do `code` da
 * authorization code flow é responsabilidade do host/frontend, antes de chegar aqui.
 */
export const keycloakCallbackSchema = z.object({
  accessToken: z.string().min(1),
})

export type KeycloakCallbackInput = z.infer<typeof keycloakCallbackSchema>
