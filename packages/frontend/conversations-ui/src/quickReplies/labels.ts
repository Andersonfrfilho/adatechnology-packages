/**
 * Vocabulário das telas de mensagens prontas. Sobrescrevível campo a campo — mesma convenção de
 * `documents/labels.ts` e `workspace/labels.ts`.
 */

export interface QuickRepliesPickerLabels {
  readonly loading: string
  readonly error: string
  readonly empty: string
  readonly noResults: string
  /** Contagem ao lado do clipe na linha (QR-32): "2 anexos". */
  readonly attachmentsCount: (count: number) => string
  /** Mostrado na linha quando a mensagem tem anexo, mas o produto não sabe mandá-lo (QR-33). */
  readonly attachmentsUnavailable: string
}

export const DEFAULT_QUICK_REPLIES_PICKER_LABELS: QuickRepliesPickerLabels = {
  loading: 'Carregando mensagens prontas…',
  error: 'Não foi possível carregar as mensagens prontas.',
  empty: 'Nenhuma mensagem pronta cadastrada ainda.',
  noResults: 'Nenhuma mensagem encontrada.',
  attachmentsCount: (count) => `${count} ${count === 1 ? 'anexo' : 'anexos'}`,
  attachmentsUnavailable: 'Este produto não envia os anexos desta mensagem — só o texto entra.',
}

export interface QuickRepliesWorkspaceLabels {
  readonly title: string
  readonly subtitle: (total: number) => string
  readonly searchPlaceholder: string
  readonly loading: string
  readonly failure: string
  readonly empty: string
  readonly noResults: string
  readonly create: string
  readonly edit: string
  readonly remove: string
  readonly removeConfirm: (title: string) => string
  readonly save: string
  readonly cancel: string
  readonly columnTitle: string
  readonly columnShortcut: string
  readonly columnBody: string
  readonly columnActions: string
  readonly fieldTitle: string
  readonly fieldTitleInvalid: string
  readonly fieldShortcut: string
  readonly fieldShortcutHint: string
  readonly fieldShortcutInvalid: string
  readonly fieldBody: string
  readonly fieldBodyInvalid: string
  readonly insertVariable: string
  readonly shortcutTaken: string
  readonly readOnlyNotice: string
  readonly saveError: string
  /** Sem `createQuickReply`/`updateQuickReply` na porta — a tela não deveria nem oferecer o botão,
   * mas o formulário ainda precisa de um texto caso chame `submit` de outro jeito. */
  readonly saveUnavailable: string
  readonly saving: string
  readonly deleting: string
  /** Seção de anexos (QR-31) — só aparece com `uploadQuickReplyAttachment` na porta. */
  readonly attachmentsTitle: string
  readonly attachmentsAdd: string
  readonly attachmentsEmpty: string
  readonly attachmentUploading: (percent: number) => string
  /** @deprecated Sem uso: não existe um "processando" observável entre a resposta do upload e o
   * item entrar em `editing.attachments` — as duas atualizações de estado acontecem no mesmo
   * commit do React. Mantido no tipo só para não quebrar quem já customiza este campo. */
  readonly attachmentProcessing: string
  readonly attachmentRetry: string
  readonly attachmentRemove: string
  readonly attachmentCancel: string
  readonly attachmentMoveUp: string
  readonly attachmentMoveDown: string
  readonly attachmentLimitReached: string
  readonly attachmentTooLarge: (filename: string) => string
  readonly saveBlockedUploading: string
  /** Barra de formatação acima do campo de texto — notação do WhatsApp. */
  readonly formatBold: string
  readonly formatItalic: string
  readonly formatStrikethrough: string
  readonly formatMonospace: string
  readonly formattingToolbar: string
  readonly previewTitle: string
  readonly previewEmptyBody: string
}

export const DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS: QuickRepliesWorkspaceLabels = {
  title: 'Mensagens prontas',
  subtitle: (total) => `${total} ${total === 1 ? 'mensagem cadastrada' : 'mensagens cadastradas'}`,
  searchPlaceholder: 'Buscar por título, atalho ou texto',
  loading: 'Carregando mensagens prontas…',
  failure: 'Não foi possível carregar as mensagens prontas.',
  empty: 'Nenhuma mensagem pronta cadastrada ainda.',
  noResults: 'Nenhuma mensagem encontrada para a busca.',
  create: 'Nova mensagem',
  edit: 'Editar',
  remove: 'Excluir',
  removeConfirm: (title) => `Excluir a mensagem "${title}"?`,
  save: 'Salvar',
  cancel: 'Cancelar',
  columnTitle: 'Título',
  columnShortcut: 'Atalho',
  columnBody: 'Texto',
  columnActions: 'Ações',
  fieldTitle: 'Título',
  fieldTitleInvalid: 'Digite um título de até 40 caracteres.',
  fieldShortcut: 'Atalho',
  fieldShortcutHint: 'Letras minúsculas, números e hífen, sem espaço nem acento.',
  fieldShortcutInvalid: 'Atalho inválido — só letras minúsculas, números e hífen, até 20 caracteres.',
  fieldBody: 'Texto',
  fieldBodyInvalid: 'Digite um texto de até 1000 caracteres.',
  insertVariable: 'Inserir variável',
  shortcutTaken: 'Esse atalho já está em uso — escolha outro.',
  readOnlyNotice: 'Você só pode consultar as mensagens prontas.',
  saveError: 'Não foi possível salvar a mensagem.',
  saveUnavailable: 'Salvar mensagens prontas não está disponível.',
  saving: 'Salvando…',
  deleting: 'Excluindo…',
  attachmentsTitle: 'Anexos',
  attachmentsAdd: 'Adicionar anexo',
  attachmentsEmpty: 'Nenhum anexo — até 10 arquivos.',
  attachmentUploading: (percent) => `Enviando… ${percent}%`,
  attachmentProcessing: 'Processando…',
  attachmentRetry: 'Tentar de novo',
  attachmentRemove: 'Remover anexo',
  attachmentCancel: 'Cancelar envio',
  attachmentMoveUp: 'Mover para cima',
  attachmentMoveDown: 'Mover para baixo',
  attachmentLimitReached: 'Limite de 10 anexos por mensagem.',
  attachmentTooLarge: (filename) => `${filename}: excede o tamanho máximo para o tipo de arquivo.`,
  saveBlockedUploading: 'Aguardando o envio dos anexos…',
  formatBold: 'Negrito',
  formatItalic: 'Itálico',
  formatStrikethrough: 'Tachado',
  formatMonospace: 'Monoespaçado',
  formattingToolbar: 'Formatação do texto',
  previewTitle: 'Pré-visualização no WhatsApp',
  previewEmptyBody: 'Digite o texto para ver como a mensagem chega ao cliente.',
}
