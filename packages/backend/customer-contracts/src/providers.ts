/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As portas que só o host pode responder.
 */

/**
 * Cifra de documento e de campo declarado cifrado. A chave é do host, separada da chave do banco
 * (`security.md` §5) — o módulo nunca a vê.
 */
export type DocumentCipherPort = {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
  /**
   * Impressão determinística do valor NORMALIZADO, para o índice cego.
   *
   * É o que torna documento cifrado pesquisável por igualdade: o texto cifrado difere a cada
   * gravação, a impressão não. Ela vaza que dois clientes têm o mesmo documento — consequência
   * inevitável de buscar por igualdade sobre dado cifrado, e justamente o que se quer descobrir.
   */
  fingerprint(plaintext: string): Promise<string>
}

/** Relógio injetável, para o teste não depender do relógio da máquina. */
export type ClockPort = { now(): Date }

export type LogMeta = Readonly<Record<string, unknown>>

export type LoggerPort = {
  info(event: string, meta?: LogMeta): void
  warn(event: string, meta?: LogMeta): void
  error(event: string, meta?: LogMeta): void
}

/**
 * Criação e remoção dos índices de expressão dos campos `filterable`.
 *
 * Porta e não implementação direta porque `CREATE INDEX CONCURRENTLY` não roda dentro de transação
 * e leva minutos em tabela grande: quem enfileira isso é o host, com a fila que ele já tem.
 */
export type FieldIndexQueuePort = {
  enqueueCreate(params: { readonly fieldName: string; readonly castTo: string }): Promise<void>
  enqueueDrop(params: { readonly fieldName: string }): Promise<void>
}
