import type {
  ConversationDocument,
  ConversationDocumentPage,
  ConversationPage,
  ConversationSummary,
} from '../providers/types'

/**
 * `fetchConversations` e `getDocuments` devolvem o array puro (contrato original) ou uma página
 * com total. Normalizar num lugar só evita que cada consumidor invente sua própria checagem —
 * e um consumidor esquecido não falha no compilador, falha em runtime com `.map is not a
 * function`.
 */
export function conversationsOf(result: ConversationSummary[] | ConversationPage): ConversationSummary[] {
  return Array.isArray(result) ? result : result.conversations
}

export function documentsOf(result: ConversationDocument[] | ConversationDocumentPage): ConversationDocument[] {
  return Array.isArray(result) ? result : result.documents
}

export function totalOf(
  result: ConversationSummary[] | ConversationPage | ConversationDocument[] | ConversationDocumentPage,
): number {
  return Array.isArray(result) ? result.length : result.total
}
