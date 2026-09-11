/**
 * Vocabulário das telas de mensagens prontas. Sobrescrevível campo a campo — mesma convenção de
 * `documents/labels.ts` e `workspace/labels.ts`.
 */

export interface QuickRepliesPickerLabels {
  readonly loading: string
  readonly error: string
  readonly empty: string
  readonly noResults: string
}

export const DEFAULT_QUICK_REPLIES_PICKER_LABELS: QuickRepliesPickerLabels = {
  loading: 'Carregando mensagens prontas…',
  error: 'Não foi possível carregar as mensagens prontas.',
  empty: 'Nenhuma mensagem pronta cadastrada ainda.',
  noResults: 'Nenhuma mensagem encontrada.',
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
}

export const DEFAULT_QUICK_REPLIES_WORKSPACE_LABELS: QuickRepliesWorkspaceLabels = {
  title: 'Mensagens prontas',
  subtitle: (total) => `${total} mensagem${total === 1 ? '' : 's'} cadastrada${total === 1 ? '' : 's'}`,
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
}
