/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Chaves centralizadas: o sino e a lista leem o mesmo `unreadCount`, e uma invalidação precisa
 * atingir os dois. Chave montada inline em cada hook é como badge e lista passam a mostrar
 * números diferentes.
 */

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notifications'] as const,
  list: (filters: { category?: string; read?: boolean }) => ['notifications', 'list', filters] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  preferences: () => ['notifications', 'preferences'] as const,
  templates: () => ['notifications', 'templates'] as const,
  templateVariables: () => ['notifications', 'template-variables'] as const,
} as const
