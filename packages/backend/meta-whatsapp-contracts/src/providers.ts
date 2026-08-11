import type { FlowActionKind, FlowNodeData } from './flow.types'
import type { ConversationSession } from './conversation.types'

/**
 * Tetos da Meta para escolha interativa.
 *
 * Ficam no contrato porque quem escreve o texto da opção precisa deles antes de publicar: passar do
 * limite não degrada nada, a Graph API recusa a mensagem inteira e o cliente vê silêncio. Botão é
 * mais curto que linha de lista, e o emoji conta como caractere.
 */
export const WHATSAPP_CHOICE_LIMIT = {
  BUTTONS: 3,
  BUTTON_TITLE_LENGTH: 20,
  LIST_ROWS: 10,
  LIST_ROW_TITLE_LENGTH: 24,
} as const

// Separa "conversa" (agnóstica de canal) de "canal" (WhatsApp/Meta) — quem envia/recebe pela
// Graph API implementa esta porta; o motor de conversa/fluxo nunca fala com a Graph API direto.
export interface ChannelAdapterInterface {
  sendText(to: string, body: string): Promise<{ externalMessageId: string | null }>
  sendMedia(params: {
    to: string
    buffer: Buffer
    mimeType: string
    filename: string
    caption?: string
  }): Promise<{ externalMessageId: string | null }>
  sendTemplate(params: {
    to: string
    templateName: string
    languageCode: string
    bodyParameters?: string[]
  }): Promise<{ externalMessageId: string | null }>
  sendInteractiveList(params: {
    to: string
    body: string
    buttonLabel: string
    rows: { id: string; title: string }[]
  }): Promise<{ externalMessageId: string | null }>
  /**
   * Botão de resposta rápida — opcional porque a lista sempre serve de alternativa.
   *
   * Exigi-lo na porta quebraria todo dublê de teste e todo canal já escrito, para uma capacidade
   * que nem todo canal tem: quem não implementa continua caindo na lista, que é o que o WhatsApp
   * fazia antes. A Meta limita a 3 botões, e o provider recusa o quarto.
   */
  sendInteractiveButtons?(params: {
    to: string
    body: string
    buttons: { id: string; title: string }[]
  }): Promise<{ externalMessageId: string | null }>
  fetchMediaAsBase64(mediaId: string): Promise<{ data: string; mimeType: string }>
}

// Resolve identidade do interlocutor (nome do cliente, empresa/tenant) a partir do número —
// o módulo não conhece a tabela de clientes do host, só pede a este porto quando precisa exibir
// um nome amigável (ex.: notificações, preview de conversa).
export interface SubjectResolverInterface {
  resolve(whatsappNumber: string): Promise<{ displayName?: string; companyId: string } | null>
}

export interface CatalogProduct {
  retailerId: string
  name: string
  priceInCents: number
  currency: string
  imageUrl?: string
  availability: 'in stock' | 'out of stock'
}

// Porta opcional — ver .specs/features/meta-catalog-trio/spec.md §4. Sem injeção, os recursos
// de produto no canal ficam desligados e o módulo de WhatsApp funciona normalmente.
export interface CatalogPort {
  listProducts(params: { catalogId: string; search?: string }): Promise<CatalogProduct[]>
  findProductByRetailerId(retailerId: string): Promise<CatalogProduct | undefined>
  consumeInventory(params: { retailerId: string; quantity: number }): Promise<void>
}

export interface ObjectStorageInterface {
  upload(params: { buffer: Buffer; mimeType: string; key: string }): Promise<{ uploadId: string }>
  /**
   * `options.disposition` decide entre abrir no navegador e salvar. Precisa ser resolvido na
   * criação da URL porque entra na assinatura — depois de assinada, o cliente não muda.
   */
  getDownloadUrl(
    uploadId: string,
    options?: { expiresInSeconds?: number; disposition?: 'inline' | 'attachment'; filename?: string },
  ): Promise<string>
  /**
   * Lê o binário de volta. Opcional pelo mesmo motivo do `delete` — quem já implementa este
   * contrato não pode quebrar ao atualizar o pacote — mas sem ele a action `send_media` fica
   * desligada: reenviar um arquivo da biblioteca ao cliente exige os bytes, e `getDownloadUrl`
   * não serve (a Graph API recebe o conteúdo, não uma URL assinada nossa).
   */
  getObject?(uploadId: string): Promise<Buffer>
  /**
   * Apaga o objeto. Opcional para não quebrar quem já implementa este contrato, mas **sem ele não
   * existe exclusão de verdade**: a cascata da FK derruba a linha e deixa o binário órfão no
   * storage, sendo cobrado indefinidamente e sem nada que o alcance.
   *
   * Deve ser idempotente — apagar o que já não existe não é erro, e o job de retenção pode repetir.
   */
  delete?(uploadId: string): Promise<void>
}

// Abstração de tempo real (SSE, WebSocket, ou nenhum) — o módulo emite eventos por este porto em
// vez de assumir SseHub; o host pode trocar a implementação ou desligar sem tocar no módulo.
export interface RealtimeNotifierInterface {
  emit(channel: string, event: string, payload: Record<string, unknown>): void
}

/**
 * Cache chave-valor do host (Redis, Memcached, o que for). Injetado como todo o resto de
 * ambiente: o módulo não abre conexão própria nem decide onde o dado mora.
 *
 * Precisa ser COMPARTILHADO entre instâncias. Um cache em memória por processo faria cada
 * instância servir uma versão diferente do mesmo fluxo depois de uma publicação, e a invalidação
 * de uma não alcançaria as outras — o cliente cairia no grafo velho ou no novo conforme o
 * balanceador.
 *
 * Valores são texto: serializar é responsabilidade de quem usa, para o contrato não impor formato.
 */
export interface CacheInterface {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}

export type FlowActionResult = {
  // Desvia o fluxo para um nó específico, ignorando o `next` declarado no grafo.
  next?: string
  // Chaves a mesclar no contexto da conversa. Sem isto, uma action que produz dado
  // (ex.: 'trigger_simulation' devolvendo o id da simulação) não teria como devolvê-lo ao
  // fluxo — nós seguintes não conseguiriam referenciar o resultado numa condição ou mensagem.
  context?: Record<string, unknown>
}

// Registro de actions de nó 'action' do fluxo — quem define o comportamento de um `actionKind`
// (ex.: 'trigger_simulation' no bot) é o host, via este registro, não o pacote (T4.3).
export type FlowActionHandler = (params: {
  node: FlowNodeData
  session: ConversationSession
  channel: ChannelAdapterInterface
  context: Record<string, unknown>
}) => Promise<FlowActionResult | void>

export interface FlowActionRegistry {
  registerFlowAction(kind: FlowActionKind, handler: FlowActionHandler): void
}
