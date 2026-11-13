/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/
const MIN_TOKEN_LENGTH = 16
const MAX_TOKEN_LENGTH = 128
const MAX_PASSWORD_LENGTH = 200

// `.strict()` e o que garante que o workspace nunca venha do formulario; a mensagem fixa nao ecoa o valor.
export const infraIntegrationSaveBodySchema = z
  .object({
    token: z
      .string()
      .min(MIN_TOKEN_LENGTH)
      .max(MAX_TOKEN_LENGTH)
      .regex(TOKEN_PATTERN, 'Formato de credencial invalido'),
    password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  })
  .strict()

export const infraIntegrationRemoveBodySchema = z
  .object({ password: z.string().min(1).max(MAX_PASSWORD_LENGTH) })
  .strict()
