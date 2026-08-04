/**
 * Textos da inbox. Todos sobrescrevíveis: o produto troca vocabulário ("cliente" vira "lead") ou
 * o idioma inteiro sem tocar no layout — e sem manter uma cópia da tela para isso.
 */

export interface ConversationsWorkspaceLabels {
  readonly title: string
  readonly conversations: string
  readonly waiting: string
  readonly unread: string
  readonly waitingOnly: string
  readonly markSelectedAsRead: string
  readonly search: string
  readonly windowLegend: string
  readonly channelLegend: string
  readonly selectAll: string
  readonly emptyList: string
  readonly emptyDetail: string
  readonly bulkSelected: (count: number) => string
  readonly bulkClear: string
  readonly bulkFinalize: string
  readonly bulkFinalizeConfirm: (count: number) => string
  readonly bulkTemplate: string
  readonly markAllAsRead: string
  readonly templateModalTitle: string
  readonly templateModalSearch: string
  readonly templateModalEmpty: string
  readonly templateModalCancel: string
  readonly templateModalSending: string
  readonly templateModalNoneExpired: string
  readonly templateModalAvailable: (count: number) => string
  readonly templateModalSend: (count: number) => string
  readonly messagesSelected: (count: number) => string
  readonly copySelected: string
  readonly composerPlaceholder: string
  readonly attachFailure: string
  /** Tira um arquivo da fila antes de enviar. */
  readonly attachmentRemove: string
  readonly recordFailure: string
  readonly sendFailure: string
  readonly takeoverToReply: string
  readonly signIn: string
  readonly pageOf: (page: number, pageCount: number) => string
  readonly rangeOf: (first: number, last: number, total: number) => string
}

export const DEFAULT_CONVERSATIONS_WORKSPACE_LABELS: ConversationsWorkspaceLabels = {
  title: 'Conversas',
  conversations: 'conversas',
  waiting: 'aguardando',
  unread: 'não lidas',
  waitingOnly: 'Aguardando atendimento',
  markSelectedAsRead: 'Marcar selecionadas como lidas',
  search: 'Buscar conversa...',
  windowLegend: 'Janela:',
  channelLegend: 'Canal:',
  selectAll: 'Selecionar todas',
  emptyList: 'Nenhuma conversa encontrada.',
  emptyDetail: 'Selecione uma conversa.',
  bulkSelected: (count) => `${count} selecionada${count === 1 ? '' : 's'}`,
  bulkClear: 'Limpar seleção',
  bulkFinalize: 'Finalizar',
  bulkFinalizeConfirm: (count) => `Finalizar ${count} conversa${count === 1 ? '' : 's'}?`,
  bulkTemplate: 'Enviar template',
  markAllAsRead: 'Marcar todas como lidas',
  templateModalTitle: 'Escolher template',
  templateModalSearch: 'Buscar template...',
  templateModalEmpty: 'Nenhum template encontrado.',
  templateModalCancel: 'Cancelar',
  templateModalSending: 'Enviando…',
  templateModalNoneExpired: 'Nenhuma das conversas selecionadas está fora da janela de 24h.',
  templateModalAvailable: (count) => `${count} template${count === 1 ? '' : 's'} disponíve${count === 1 ? 'l' : 'is'}`,
  templateModalSend: (count) => `Enviar para ${count}`,
  messagesSelected: (count) => `${count} mensagem${count === 1 ? '' : 's'} selecionada${count === 1 ? '' : 's'}`,
  copySelected: 'Copiar',
  composerPlaceholder: 'Responder como atendente…',
  attachFailure: 'Falha ao enviar o arquivo.',
  attachmentRemove: 'Remover anexo',
  recordFailure: 'Falha ao gravar o áudio.',
  sendFailure: 'Falha ao enviar a mensagem.',
  takeoverToReply: 'Assuma o atendimento para responder diretamente ao cliente.',
  signIn: 'Entrar no painel',
  pageOf: (page, pageCount) => `${page} / ${pageCount}`,
  rangeOf: (first, last, total) => (total === 0 ? `0 de 0` : `${first}–${last} de ${total}`),
}
