/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14: o `sha256` do MIME bruto, calculado sobre os bytes **exatamente como chegaram** — antes de
 * qualquer parse, decodificação de cabeçalho ou normalização de quebra de linha. É o que
 * `ConversationEmailTransportPort.recordRawInboundEmail` devolve; quem grava os bytes e o hash no
 * armazenamento é o host, por `ObjectStoragePort` — esta função é só o cálculo, sem I/O.
 */
import { createHash } from 'node:crypto'

export function computeRawEmailSha256(rawMime: Uint8Array): string {
  return createHash('sha256').update(rawMime).digest('hex')
}
