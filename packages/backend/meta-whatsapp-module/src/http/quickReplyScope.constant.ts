/**
 * Escopo padrão da escrita de respostas rápidas (criar, editar, apagar). A leitura é de qualquer
 * agente autenticado — o seletor do composer precisa dela —, então não tem escopo padrão. O host
 * troca o vocabulário em `createMetaWhatsAppQuickReplyRoutes({ scopes })` se o dele for outro.
 */
export const QUICK_REPLY_SCOPE = {
  WRITE: 'quick-replies:write',
} as const

export type QuickReplyRouteScopes = {
  /** Escopos que liberam criar, editar e apagar. Basta um. Padrão: `quick-replies:write`. */
  readonly write?: readonly string[]
  /** Exige escopo também na leitura. Ausente, basta estar autenticado como agente. */
  readonly read?: readonly string[]
}

export const DEFAULT_QUICK_REPLY_WRITE_SCOPES: readonly string[] = [QUICK_REPLY_SCOPE.WRITE]
