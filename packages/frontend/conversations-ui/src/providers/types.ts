import type { MessagePayload, MessageTranscription } from '../types'
import type { ConversationChannel } from '../conversationChannel'

export interface ListConversationsParams {
  page?: number
  limit?: number
  waitingHuman?: boolean
  search?: string
  /**
   * Recortes que só o produto conhece (tipo de financiamento, carteira, campanha) repassados
   * crus ao backend dele. É o que evita o vocabulário de uma vertical virar campo fixo aqui:
   * o pacote transporta o filtro sem saber o que ele significa.
   */
  filters?: Record<string, string | undefined>
}

/**
 * Página com o total, para a UI conseguir desenhar controles de paginação.
 *
 * `fetchConversations` devolve isto **ou** o array puro de antes: implementações existentes
 * continuam válidas sem mudar uma linha, e quem precisa paginar passa a ter o total. Sem a união
 * seria impossível saber se um retorno curto é a última página ou uma página cheia por acaso.
 */
export interface ConversationPage {
  conversations: ConversationSummary[]
  total: number
}

export interface ListDocumentsParams {
  search?: string
  page?: number
  /** Tamanho da página. Sem ele, `page` sozinho não define fatia nenhuma. */
  limit?: number
  /**
   * Origem do arquivo (`customer`, `agent`, `bot`…). O vocabulário é do host.
   *
   * Seleção múltipla viaja como lista separada por vírgula em vez de virar `string[]`: mudar o
   * tipo quebraria em compile-time toda implementação de host que já repassa este campo adiante,
   * e o ganho seria nenhum — quem recebe faz `split(',')`.
   */
  source?: string
  /** Categoria do arquivo (`document`, `image`, `audio`, `video`…), mesma convenção de lista. */
  fileCategory?: string
  /** Recorte por data de recebimento, em `YYYY-MM-DD`. */
  startDate?: string
  endDate?: string
  sortDirection?: 'asc' | 'desc'
  /** Coluna ordenada. Ausente, o host ordena pela data — é o padrão de toda listagem de arquivo. */
  sortField?: string
  /**
   * Filtros que só existem no produto (`clientId`, `unidade`…). O pacote não os interpreta: passa
   * adiante o que o host injetou pelo slot de filtros. É a porta que evita um fork da tela por
   * causa de um `<select>`.
   */
  extra?: Readonly<Record<string, string | number>>
}

/** Arquivo na biblioteca da empresa: o mesmo da conversa, mais de qual conversa veio. */
export interface CompanyDocument extends ConversationDocument {
  conversationId: string
  /**
   * Nome de quem enviou, quando o host o conhece. Opcional porque a biblioteca sempre tem o
   * telefone e nem todo produto tem cadastro por trás dele — ausente, a coluna cai para o número.
   */
  contactName?: string | null
}

export interface CompanyDocumentPage {
  documents: CompanyDocument[]
  total: number
}

export interface ConversationDocumentPage {
  documents: ConversationDocument[]
  total: number
}

/**
 * Template disponível para envio a partir da inbox. Distinto do `WhatsAppTemplateSummary` de
 * `settings/`, e de propósito: aquele serve ao formulário que **edita** template e carrega o que
 * a edição precisa (`shortId`, `variableCount`); este serve a quem só vai **escolher um para
 * enviar**, e pedir os campos de edição obrigaria todo host a produzi-los sem uso.
 */
export interface ConversationTemplate {
  name: string
  language: string
  status: string
  category?: string
  bodyText?: string | null
}

export interface ConversationsApi {
  fetchMessages(conversationId: string, params?: { limit?: number; before?: string }): Promise<MessagePayload[]>
  fetchConversations(params?: ListConversationsParams): Promise<ConversationSummary[] | ConversationPage>
  sendMessage(conversationId: string, text: string): Promise<MessagePayload>
  sendMedia(
    conversationId: string,
    data: { base64: string; mimeType: string; filename: string; caption?: string },
  ): Promise<MessagePayload>
  /**
   * `templateName` é opcional porque reabrir a janela é a operação, e escolher *qual* template a
   * usa nem sempre é decisão da UI: backends que guardam um template padrão configurado só
   * precisam do "reabra". Exigir o nome obrigaria toda inbox a listar templates antes de poder
   * mandar o primeiro — e a listagem é `listTemplates?`, opcional.
   */
  sendTemplate(
    conversationId: string,
    data: { templateName?: string; languageCode?: string; bodyParams?: string[] },
  ): Promise<void>
  markRead(conversationId: string): Promise<void>
  getContext(conversationId: string): Promise<Record<string, unknown>>
  getDocuments(
    conversationId: string,
    params?: ListDocumentsParams,
  ): Promise<ConversationDocument[] | ConversationDocumentPage>
  /**
   * `disposition` decide entre abrir no navegador e baixar. É o backend que assina a URL e grava
   * o `Content-Disposition` nela, então a escolha precisa viajar na chamada — depois de assinada
   * não há como o cliente mudá-la. Ausente = o padrão do host.
   */
  getDocumentUrl(uploadId: string, disposition?: 'inline' | 'attachment'): Promise<string>
  /**
   * Baixa vários arquivos num zip único.
   *
   * **Opcional por capacidade:** montar zip exige o host LER os bytes do storage, o que nem toda
   * instalação faz — as que só assinam URL não conseguem. Ausente, o painel esconde a seleção em
   * lote em vez de oferecer um botão que falha.
   */
  downloadDocumentsArchive?(conversationId: string, uploadIds: readonly string[]): Promise<Blob>
  /**
   * Biblioteca de TODAS as conversas, para uma tela de Documentos fora do atendimento.
   *
   * Opcional por capacidade: host que só expõe anexo dentro da conversa não implementa, e o
   * componente de biblioteca simplesmente não é usável — melhor que uma tela que sempre erra.
   */
  getAllDocuments?(params?: ListDocumentsParams): Promise<CompanyDocumentPage>
  /**
   * Remove um arquivo da biblioteca. **Opcional por capacidade:** apagar anexo trocado com o
   * cliente é decisão de retenção do produto — instalação que precisa guardar tudo por obrigação
   * legal não implementa, e a tela simplesmente não desenha a lixeira.
   */
  deleteDocument?(uploadId: string): Promise<void>
  /**
   * Zip de arquivos avulsos da biblioteca, sem conversa de origem única — irmão do
   * `downloadDocumentsArchive`, que é por conversa. Ausente, a seleção em lote não oferece o botão.
   */
  downloadDocumentsArchiveByIds?(uploadIds: readonly string[]): Promise<Blob>
  getMediaProxyUrl(mediaId: string): Promise<{ mimeType: string; data: string }>

  /**
   * Operações de atendimento humano. **Opcionais por capacidade, não por descuido:** nem toda
   * inbox tem fila humana — um canal só-bot, ou um chat de site sem operador, não sabe o que é
   * assumir conversa. Quem não implementa não ganha o botão, em vez de ganhar um botão que
   * estoura no clique. Os hooks devolvem `undefined` para a ação ausente, e é isso que a UI
   * consulta para decidir se desenha a afordância.
   */
  takeover?(conversationId: string): Promise<void>
  release?(conversationId: string): Promise<void>
  /** Encerra o atendimento. Despedida, se houver, é decisão do host — o pacote não a inventa. */
  finalize?(conversationId: string): Promise<void>

  markAllRead?(): Promise<void>
  listTemplates?(): Promise<ConversationTemplate[]>

  /**
   * Transcrição completa gerada pelo servidor. Existe ao lado de `buildTranscriptText`, que monta
   * a partir das mensagens já em memória: a tela costuma ter só a última página carregada, e
   * exportar dali entregaria um recorte parcial com cara de histórico inteiro. Opcional porque
   * nem todo backend expõe a rota — quem não tem continua usando o builder local.
   */
  exportTranscript?(conversationId: string): Promise<{ transcript: string; filename: string }>

  /**
   * Transcreve o áudio de uma mensagem e devolve o resultado.
   *
   * **Opcional por capacidade.** Um host em modo automático transcreve na ingestão e não expõe rota
   * nenhuma; um host sem engine configurado não transcreve de jeito algum. Nos dois casos o balão
   * simplesmente não desenha o botão, em vez de oferecer uma ação que estoura no clique.
   *
   * `messageId` e não `conversationId`: transcrição é por áudio, e uma conversa tem vários.
   */
  transcribeAudio?(messageId: string): Promise<MessageTranscription>
}

/**
 * Superfície mínima de stream que o pacote consome — exatamente o que `useConversationRealtime`
 * usa: assinar 'message', desassinar e fechar. Deliberadamente estrutural em vez de
 * `EventSource`: sem servidor HTTP não existe `EventSource`, e é isso que impediria alimentar a
 * inbox com dados mockados em desenvolvimento. Um `EventSource` nativo satisfaz este tipo, então
 * quem já implementa `SSEProvider` continua válido sem mudança.
 */
export interface ConversationEventSource {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  close(): void
}

/**
 * Eventos nomeados que o servidor realmente emite (`event: <nome>` no fio). O canal por conversa
 * é `conv:<whatsappNumber>`; o global só emite `data-changed`, como sinal de "refaça a query".
 * Tipar `addEventListener` como `string` em vez de `'message'` existe por isto: quem assina
 * precisa alcançar `message-status` e `mode-changed`, não só `message`.
 */
export const CONVERSATION_STREAM_EVENTS = ['message', 'message-status', 'mode-changed'] as const
export type ConversationStreamEvent = (typeof CONVERSATION_STREAM_EVENTS)[number]

export const GLOBAL_STREAM_EVENTS = ['data-changed'] as const
export type GlobalStreamEvent = (typeof GLOBAL_STREAM_EVENTS)[number]

export interface SSEProvider {
  connectConversationStream(conversationId: string): ConversationEventSource
  connectGlobalStream(): ConversationEventSource
}

export interface ConversationSummary {
  id: string
  /**
   * @deprecated Use `contactId` com `channel`. Mantido obrigatório para não quebrar quem já
   * consome; some quando o segundo canal entrar em produção.
   */
  whatsappNumber: string
  /** Identificador neutro do contato. Ausente = usa `whatsappNumber`. */
  contactId?: string
  /** Ausente = `whatsapp`, o comportamento de antes desta mudança. */
  channel?: ConversationChannel
  clientName?: string
  lastContent?: string
  lastDirection?: 'inbound' | 'outbound'
  lastAt: string
  lastInboundAt: string | null
  mode: 'bot' | 'human'
  assignedUserId: string | null
  waitingHuman: boolean
  unread: number
  currentState: string
  /**
   * Atributos que só o produto conhece e desenha (tipo de financiamento, carteira, campanha). É a
   * contraparte de leitura do `filters` de `ListConversationsParams`: o pacote transporta e nunca
   * interpreta. Sem isto, exibir um selo próprio na linha exigiria o host manter uma segunda
   * consulta paralela à mesma listagem — a implementação duplicada que o pacote existe para evitar.
   */
  attributes?: Record<string, string | undefined>
}

export interface ConversationDocument {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  source: string
  linkedAt: string
}
