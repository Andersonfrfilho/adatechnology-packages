/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export * from './headless'

export { NotificationBell } from './components/NotificationBell'
export type { NotificationBellProps } from './components/NotificationBell'

export { NotificationList } from './components/NotificationList'
export type { NotificationListProps } from './components/NotificationList'

export { NotificationItem } from './components/NotificationItem'
export type { NotificationItemProps } from './components/NotificationItem'

export { PreferencesPanel } from './components/PreferencesPanel'
export type { PreferencesPanelProps } from './components/PreferencesPanel'

/**
 * As telas COMPOSTAS. Consumir estas, não as peças — remontar o grid no produto é o que fez as
 * telas divergirem antes (`pluggable-module.md` §4).
 */
export { NotificationsWorkspace } from './components/NotificationsWorkspace'
export type { NotificationsWorkspaceProps } from './components/NotificationsWorkspace'
export { NotificationSettingsWorkspace } from './components/NotificationSettingsWorkspace'
export type {
  NotificationSettingsWorkspaceProps,
  NotificationChannelOption,
  NotificationCategoryOption,
} from './components/NotificationSettingsWorkspace'

/** Modos de exibição e ordenação da lista de mensagens — o host pode rotular ou pré-selecionar. */
export { TEMPLATE_VIEWS, TEMPLATE_SORT_FIELDS, TEMPLATE_COLUMNS, SORT_DIRECTIONS } from './templateList.constant'
export type {
  TemplateView,
  TemplateSortField,
  TemplateSort,
  TemplateColumn,
  SortDirection,
} from './templateList.constant'

/** Campo de codigo com realce e laudo — o mesmo que o editor de mensagem usa no corpo de e-mail. */
export { HtmlCodeField } from './components/HtmlCodeField'
export type { HtmlCodeFieldProps, HtmlCodeFieldProblem } from './components/HtmlCodeField'
export { tokenizeHtml, HTML_TOKEN } from './htmlHighlight.util'
export type { HtmlToken, HtmlTokenKind } from './htmlHighlight.util'

/** Caixa de mensagem com barra de formatacao — marcacao do WhatsApp, unica para todos os canais. */
export { MessageBodyField } from './components/MessageBodyField'
export type { MessageBodyFieldProps } from './components/MessageBodyField'
export { MessageToolbar } from './components/MessageToolbar'
export type { MessageToolbarProps } from './components/MessageToolbar'
export { MESSAGE_FORMAT, MESSAGE_FORMAT_MARKS, MESSAGE_EMOJI } from './messageFormat.constant'
export type { MessageFormat, MessageFormatMark } from './messageFormat.constant'
export { applyMark, insertAt } from './messageFormat.util'
