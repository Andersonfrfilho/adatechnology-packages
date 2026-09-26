/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14: o token do endereço de resposta é derivado, não sorteado. Guardar um token aleatório em
 * claro seria a única forma de reusá-lo no `Reply-To` de toda a conversa, e é justamente o que não
 * se quer no banco: aqui o banco guarda só o `sha256`, e o token se recalcula quando precisa.
 *
 * A fórmula, e cada escolha dela, é herdada da implementação em produção do produto de origem — o
 * contrato em `replyToken.test.ts` fixa a saída byte a byte. O que mudou é o **prefixo**, que lá era
 * literal e aqui é parâmetro do host: trocar o prefixo troca todo endereço de resposta em uso.
 */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

/** 128 bits: 26 caracteres de base32, curto o bastante para caber num endereço sem quebrar linha. */
const TOKEN_BYTES = 16
/** Base32 minúscula (RFC 4648 sem preenchimento): endereço de e-mail não distingue caixa. */
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

export type DeriveReplyTokenInput = {
  readonly companyId: string
  readonly conversationId: string
  /** Rótulo do host, versionado (`<produto>:<assunto>:v1`). Trocá-lo invalida os endereços em uso. */
  readonly prefix: string
  /** Segredo do host em hexadecimal; nunca vai a log, a banco em claro nem a mensagem de erro. */
  readonly secret: string
}

export type VerifyReplyTokenInput = DeriveReplyTokenInput & {
  readonly token: string
}

export type BuildReplyAddressInput = {
  readonly domain: string
  readonly token: string
}

export function deriveReplyToken(input: DeriveReplyTokenInput): string {
  const digest = createHmac('sha256', Buffer.from(input.secret, 'hex'))
    .update(`${input.prefix}:${input.companyId}:${input.conversationId}`)
    .digest()

  return encodeBase32Lowercase(digest.subarray(0, TOKEN_BYTES))
}

/** O que a tabela guarda: o hash do token, nunca o token. */
export function hashReplyToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Comparação de tempo constante sobre digests de tamanho fixo — comparar os tokens direto vazaria,
 * pelo tempo, quantos caracteres iniciais um palpite acertou, e `timingSafeEqual` ainda lançaria com
 * entrada de outro tamanho.
 */
export function verifyReplyToken(input: VerifyReplyTokenInput): boolean {
  const expected = createHash('sha256').update(deriveReplyToken(input)).digest()
  const received = createHash('sha256').update(input.token).digest()
  return timingSafeEqual(expected, received)
}

export function buildReplyAddress(input: BuildReplyAddressInput): string {
  return `${input.token}@${input.domain}`
}

function encodeBase32Lowercase(buffer: Uint8Array): string {
  let bitBuffer = 0
  let bitCount = 0
  let output = ''

  for (const byte of buffer) {
    bitBuffer = (bitBuffer << 8) | byte
    bitCount += 8

    while (bitCount >= 5) {
      output += BASE32_ALPHABET[(bitBuffer >>> (bitCount - 5)) & 0b11111]
      bitCount -= 5
    }
  }

  if (bitCount > 0) {
    output += BASE32_ALPHABET[(bitBuffer << (5 - bitCount)) & 0b11111]
  }

  return output
}
