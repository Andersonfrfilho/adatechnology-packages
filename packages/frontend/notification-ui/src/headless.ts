/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Camada headless isolada das telas (regra de módulos plugáveis §4.4): o produto que monta a
 * própria interface importa daqui e não carrega componente, CSS nem `lucide-react`.
 */

export { NotificationProvider, useNotificationContext } from './NotificationProvider'
export type { NotificationProviderProps, NotificationContextValue, NotificationTheme } from './NotificationProvider'

export {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  flattenNotificationPages,
} from './hooks/useNotifications'
export type { UseNotificationsOptions } from './hooks/useNotifications'

export { useNotificationStream } from './hooks/useNotificationStream'
export type { UseNotificationStreamOptions } from './hooks/useNotificationStream'

export { usePreferences, useUpdatePreferences, useTemplates } from './hooks/usePreferences'

export { NOTIFICATION_QUERY_KEYS } from './hooks/queryKeys'

export { DEFAULT_LOCALE, resolveMessages } from './locales'
export type { NotificationLocale, NotificationMessages } from './locales'
