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
