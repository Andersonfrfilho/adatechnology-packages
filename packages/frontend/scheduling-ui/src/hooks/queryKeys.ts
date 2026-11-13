/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Chaves centralizadas: mutação e listagem da mesma entidade precisam invalidar a mesma raiz, e
 * uma chave montada inline em cada hook é como agenda e tabela de reservas passam a mostrar
 * estados diferentes depois de uma confirmação.
 */

export const SCHEDULING_QUERY_KEYS = {
  resources: {
    all: ['scheduling', 'resources'] as const,
    list: (params: unknown) => ['scheduling', 'resources', 'list', params] as const,
  },
  services: {
    all: ['scheduling', 'services'] as const,
    list: (params: unknown) => ['scheduling', 'services', 'list', params] as const,
  },
  availabilityRules: {
    all: (resourceId: string) => ['scheduling', 'availability-rules', resourceId] as const,
  },
  availabilityExceptions: {
    all: (resourceId: string) => ['scheduling', 'availability-exceptions', resourceId] as const,
  },
  availableSlots: {
    list: (params: unknown) => ['scheduling', 'available-slots', params] as const,
  },
  bookings: {
    all: ['scheduling', 'bookings'] as const,
    list: (params: unknown) => ['scheduling', 'bookings', 'list', params] as const,
    detail: (id: string) => ['scheduling', 'bookings', 'detail', id] as const,
  },
} as const
