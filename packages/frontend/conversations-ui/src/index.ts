export { MessageBubble } from './MessageBubble'
export { InteractiveMessage, DEFAULT_INTERACTIVE_MESSAGE_LABELS } from './InteractiveMessage'
export { ConversationWallpaper } from './Wallpaper'
export { ConversationLocalesProvider, useConversationLocales } from './ConversationLocalesProvider'
export { AudioPlayer } from './AudioPlayer'
export { AudioTranscription } from './AudioTranscription'
export { EmojiPicker, DEFAULT_EMOJI_PICKER_LABELS } from './EmojiPicker'
export { EMOJI_CATEGORIES, searchEmojis } from './emojiCatalog'
export { MessageComposer, DEFAULT_MESSAGE_COMPOSER_LABELS, DEFAULT_ACCEPTED_FILE_TYPES } from './MessageComposer'
export { RichMessageComposer, RICH_COMPOSER_ACTION, DEFAULT_RICH_COMPOSER_TOOLTIPS } from './RichMessageComposer'
export type {
  RichMessageComposerProps,
  RichComposerAction,
  RichComposerTooltips,
  RichComposerQuickReply,
  RichComposerVariable,
  RichMessageComposerHandle,
} from './RichMessageComposer'
export {
  AudioRecorderButton,
  DEFAULT_AUDIO_RECORDER_BUTTON_LABELS,
  DEFAULT_MAX_RECORDING_MILLISECONDS,
} from './AudioRecorderButton'
export type { AudioRecorderButtonProps, AudioRecorderButtonLabels } from './AudioRecorderButton'
export { WhatsAppMessageEditor, DEFAULT_WHATSAPP_MESSAGE_EDITOR_LABELS } from './WhatsAppMessageEditor'
export { SimpleEmojiPicker } from './SimpleEmojiPicker'
export { DateDivider } from './DateDivider'
export { Avatar, DEFAULT_AVATAR_LABELS } from './Avatar'
export { ConversationListItem, DEFAULT_CONVERSATION_LIST_ITEM_LABELS } from './ConversationListItem'
export { ToastProvider, useToast, toast } from './Toast'
export { TooltipLayer, TOOLTIP_ATTRIBUTE } from './Tooltip'

export { StatusTicks } from './StatusTicks'
export { Lightbox, DEFAULT_LIGHTBOX_LABELS } from './Lightbox'
export { MediaRenderer } from './MediaRenderer'
export { FileIcon } from './FileIcon'
export { MessageText } from './MessageText'
export { MessageTimestamp } from './MessageTimestamp'
export { MessageTail } from './MessageTail'

// Operação da inbox: janela de 24h da Meta, linha com ações e painéis do atendimento. Regras da
// plataforma e do ofício de atender, não de um produto — por isso moram aqui.
export { CONVERSATION_WINDOW, WINDOW_FILTERS, windowOf, formatStalledFor } from './conversationWindow'
export type { WindowOfParams } from './conversationWindow'
// Canal de origem: capacidades por plataforma (janela de sessão, reabertura, tipo de identificador).
export {
  CONVERSATION_CHANNEL,
  DEFAULT_CONVERSATION_CHANNEL,
  CHANNEL_CAPABILITIES,
  channelFiltersFor,
  CHANNEL_FILTER_ALL,
  REOPEN_MECHANISM,
  HANDLE_KIND,
  capabilitiesOf,
  formatContactHandle,
  contactFlag,
} from './conversationChannel'
export type {
  ConversationChannel,
  ChannelCapabilities,
  ChannelFilter,
  ChannelFilterOption,
  ReopenMechanism,
  HandleKind,
  FormatContactHandleParams,
} from './conversationChannel'
export type { ConversationWindow } from './conversationWindow'
export { ConversationRow } from './ConversationRow'
export { ChannelIcon, CHANNEL_BRAND_COLOR } from './ChannelIcon'
export type { ChannelIconProps } from './ChannelIcon'
export type { ConversationRowProps, ConversationRowClassNames } from './ConversationRow'
export { ConversationHeader, DEFAULT_CONVERSATION_HEADER_LABELS } from './ConversationHeader'
export type {
  ConversationHeaderProps,
  ConversationHeaderLabels,
  ConversationHeaderClassNames,
} from './ConversationHeader'
export { ConversationContextPanel, DEFAULT_CONVERSATION_CONTEXT_LABELS } from './ConversationContextPanel'
export type {
  ConversationContextPanelProps,
  ConversationContextEntry,
  ConversationContextStatus,
  ConversationContextPanelLabels,
  ConversationContextPanelClassNames,
} from './ConversationContextPanel'
export { WindowExpiredNotice, isWindowBlocking, DEFAULT_WINDOW_EXPIRED_LABELS } from './WindowExpiredNotice'
export type { WindowExpiredNoticeProps, WindowExpiredNoticeLabels } from './WindowExpiredNotice'
export { DocumentsLibrary, DEFAULT_DOCUMENTS_LIBRARY_LABELS } from './DocumentsLibrary'
export type { DocumentsLibraryProps, DocumentsLibraryLabels, DocumentsLibraryClassNames } from './DocumentsLibrary'
export { DocumentsWorkspace, DEFAULT_DOCUMENTS_WORKSPACE_LABELS } from './documents'
export type {
  DocumentsWorkspaceProps,
  DocumentsWorkspaceLabels,
  DocumentsWorkspaceClassNames,
  DocumentsFiltersContext,
} from './documents'
export { SortableHead, MultiSelectFilter, BulkActionBar, ListingPagination } from './listing'
export type {
  SortableHeadProps,
  MultiSelectFilterProps,
  BulkActionBarProps,
  ListingPaginationProps,
  FilterOption,
  SortDirection,
} from './listing'
export { useUrlStringState, useUrlNumberState, useUrlArrayState, useDebouncedValue } from './hooks/useUrlFilterState'
export type { UrlStateOptions } from './hooks/useUrlFilterState'
export { DOCUMENT_SOURCE_FILTER } from './ConversationDocumentsPanel'
export type { DocumentSourceFilter } from './ConversationDocumentsPanel'
export type { ConversationDocumentsPanelClassNames } from './ConversationDocumentsPanel'
export { ConversationDocumentsPanel, DEFAULT_CONVERSATION_DOCUMENTS_LABELS } from './ConversationDocumentsPanel'
export type { ConversationDocumentsPanelProps, ConversationDocumentsPanelLabels } from './ConversationDocumentsPanel'
export { buildTranscriptText, buildTranscriptFilename, downloadTextFile } from './conversationTranscript'
export type { BuildTranscriptTextParams } from './conversationTranscript'

export { useDarkMode, useIsDarkTheme } from './useDarkMode'
export { DarkModeToggle, DEFAULT_DARK_MODE_TOGGLE_LABELS } from './DarkModeToggle'
export type { DarkModeToggleProps, DarkModeToggleLabels } from './DarkModeToggle'
export { useIsNarrow, NARROW_MAX_WIDTH_PX } from './useIsNarrow'
export { useWaitingNotifications } from './useWaitingNotifications'
export type {
  UseWaitingNotificationsLabels,
  UseWaitingNotificationsParams,
  UseWaitingNotificationsResult,
} from './useWaitingNotifications'

export { ConversationsProvider, useConversations } from './providers/ConversationsProvider'

// Telas de Settings (T7.1) — apresentacionais, sem chamada de rede própria; o host busca
// dados (templates da Meta, mensagens salvas) e injeta via props.
export { WhatsAppTemplateSettingsForm } from './settings/WhatsAppTemplateSettingsForm'
export { WhatsAppCreateTemplateForm } from './settings/WhatsAppCreateTemplateForm'
export { WelcomeFarewellForm } from './settings/WelcomeFarewellForm'
export { TranscriptionSettingsForm } from './settings/TranscriptionSettingsForm'
export {
  WhatsAppTemplatesSettings,
  TEMPLATE_SETTINGS_TAB,
  DEFAULT_TEMPLATES_SETTINGS_LABELS,
} from './settings/WhatsAppTemplatesSettings'
export { TopicsForm } from './settings/TopicsForm'

// Tela composta de Mensagens: junta os formulários acima com abas, estado e salvamento, para o
// host não remontar essa mesma colagem em cada produto (foi assim que eles divergiram).
export { MessagesWorkspace } from './settings/MessagesWorkspace'
export type {
  MessagesWorkspaceProps,
  MessagesWorkspaceApi,
  MessagesWorkspaceLabels,
  BotMessages,
  TemplateSettings,
  TranscriptionSettings,
} from './settings/MessagesWorkspace'

// Camada headless (T6.9) — hooks de dados/ações independentes de qualquer tela, para o
// produto montar sua própria UI sobre eles. Requerem <ConversationsProvider> como ancestral.
export { useConversationMessages } from './hooks/useConversationMessages'
export { useScrollToLatestMessage } from './hooks/useScrollToLatestMessage'
export { useConversationList } from './hooks/useConversationList'
export { useConversationContext } from './hooks/useConversationContext'
export { useConversationDocuments } from './hooks/useConversationDocuments'
export { useConversationRealtime, useGlobalRealtime } from './hooks/useConversationRealtime'
export { useConversationActions, useInboxActions } from './hooks/useConversationActions'

export { parseWhatsAppFormatting, waToHTML, htmlToWA, waToHTMLInline } from './lib/whatsapp-formatting'
export { formatPhone, phoneInitials } from './lib/phone'
// `formatDateTime` e `isSameDay` já eram usados pelas bolhas e pelo divisor de data; exportá-los
// evita que cada host mantenha a própria cópia e acabe com timeline e transcript divergindo.
export { formatTimestamp, formatFileSize, formatDateTime, isSameDay } from './lib/format'

export type { MessagePayload, ConversationsUIConfig, ConversationsTheme, ConversationsFeatures } from './types'
export type { InteractivePayload, InteractiveSection, InteractiveOption, InteractiveSelection } from './types'
export type { MessageTranscription, TranscriptionStatus, TranscriptionMode } from './types'
export type {
  ConversationsApi,
  SSEProvider,
  ConversationEventSource,
  ConversationSummary,
  ConversationDocument,
  ConversationPage,
  ConversationDocumentPage,
  CompanyDocument,
  CompanyDocumentPage,
  ConversationTemplate,
  ListConversationsParams,
  ListDocumentsParams,
} from './providers/types'
export type { UseConversationActionsResult, UseInboxActionsResult } from './hooks/useConversationActions'

export type { MessageBubbleProps } from './MessageBubble'
export type { ConversationWallpaperProps } from './Wallpaper'
export type { ConversationLocales, ConversationLocalesProviderProps } from './ConversationLocalesProvider'
export type { AudioPlayerProps } from './AudioPlayer'
export type { AudioTranscriptionProps } from './AudioTranscription'
export type { EmojiPickerProps, EmojiPickerLabels } from './EmojiPicker'
export type { EmojiEntry, EmojiCategory } from './emojiCatalog'
export type { InteractiveMessageProps, InteractiveMessageLabels } from './InteractiveMessage'
export type { MessageComposerProps, MessageComposerClassNames, MessageComposerLabels } from './MessageComposer'
export type { WhatsAppMessageEditorProps, WhatsAppMessageEditorLabels } from './WhatsAppMessageEditor'
export type { SimpleEmojiPickerProps } from './SimpleEmojiPicker'
export type { DateDividerProps, DateDividerClassNames } from './DateDivider'
export type { AvatarProps, AvatarLabels } from './Avatar'
export type { ConversationListItemProps, ConversationListItemLabels } from './ConversationListItem'
export type { StatusTicksProps } from './StatusTicks'
export type { LightboxProps, LightboxLabels } from './Lightbox'
export type { MediaRendererProps, ResolveMediaUrl } from './MediaRenderer'
export type { FileIconProps } from './FileIcon'
export type { MessageTextProps } from './MessageText'

export type {
  WhatsAppTemplateSettingsFormProps,
  WhatsAppTemplateSummary,
  WhatsAppTemplateVariableSuggestion,
  WhatsAppTemplateSettingsFormLabels,
} from './settings/WhatsAppTemplateSettingsForm'
export type {
  WhatsAppCreateTemplateFormProps,
  WhatsAppCreateTemplateState,
  WhatsAppCreateTemplateResult,
  WhatsAppTemplateHeaderType,
  WhatsAppCreateTemplateFormLabels,
} from './settings/WhatsAppCreateTemplateForm'
export type { WelcomeFarewellFormProps, WelcomeFarewellFormLabels } from './settings/WelcomeFarewellForm'
export type {
  TranscriptionSettingsFormProps,
  TranscriptionSettingsFormLabels,
} from './settings/TranscriptionSettingsForm'
export type {
  WhatsAppTemplatesSettingsProps,
  WhatsAppTemplatesSettingsLabels,
  TemplateSettingsTab,
} from './settings/WhatsAppTemplatesSettings'
export type { TopicsFormProps, TopicItem, TopicsFormLabels } from './settings/TopicsForm'

export type { UseConversationMessagesResult } from './hooks/useConversationMessages'
export type { UseConversationListParams, UseConversationListResult } from './hooks/useConversationList'
export type { UseConversationContextResult } from './hooks/useConversationContext'
export type { UseScrollToLatestMessageParams, UseScrollToLatestMessageResult } from './hooks/useScrollToLatestMessage'
export type { UseConversationDocumentsParams, UseConversationDocumentsResult } from './hooks/useConversationDocuments'
export type { ConversationRealtimeHandler } from './hooks/useConversationRealtime'
export type { AsyncResourceState } from './hooks/useAsyncResource'
export { createMediaUrlResolver } from './lib/createMediaUrlResolver'
export type { ConversationHeaderUtility } from './ConversationHeader'
export { applyQuickReplyVariables, resolveQuickReply } from './MessageComposer'
export type { QuickReply } from './MessageComposer'

// Tela de atendimento completa. Fica no export principal — e não num subpath — porque é a
// composição padrão do pacote: quem instala conversas quer esta tela, e as peças continuam
// exportadas ao lado para quem precisar montar outra.
export { ConversationsWorkspace, ConversationPane, ConversationsInboxList } from './workspace'
export { useConversationsInbox, CONVERSATIONS_PER_PAGE, DEFAULT_CONVERSATIONS_WORKSPACE_LABELS } from './workspace'
export type {
  ConversationsWorkspaceProps,
  ConversationsWorkspaceSimulator,
  SimulatorTransportFactory,
  SimulatorTransportParams,
  ConversationsWorkspaceLabels,
  ConversationPaneProps,
  ConversationsInboxListProps,
  UseConversationsInboxParams,
  UseConversationsInboxResult,
} from './workspace'

// A porta do simulador entra no export principal como TIPO: `simulator.transports` é tipado por ela,
// e obrigar o host a abrir o subpath `/preview` só para declarar a fábrica seria pedir que ele
// importasse fixtures para escrever uma assinatura. `export type` é apagado no build — o `preview/`
// continua fora do bundle de quem só declara o transporte.
export type {
  ConversationSimulatorClient,
  SendSimulatorMediaParams,
  SimulatorMediaKind,
} from './preview/ConversationSimulatorClient'
