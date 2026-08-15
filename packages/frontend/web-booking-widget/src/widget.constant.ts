/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

export const WIDGET_TAG_NAME = 'ada-booking-widget'

/** Atributo obrigatório: a origem da API muda por ambiente e nunca é chutada no código. */
export const API_BASE_ATTRIBUTE = 'api-base'

/** JSON com os tokens de tema — o widget não nasce com cor de marca própria (spec T8.3). */
export const THEME_ATTRIBUTE = 'theme'

/**
 * O produto é quem serve estas rotas, nunca o `scheduling-module` diretamente (spec Q2).
 *
 * O widget roda enxertado em página de terceiro e não pode carregar política de abuso — quem
 * decide autenticação, rate limit e captcha na borda é a API do produto.
 */
export const WIDGET_PATH = {
  SERVICES: '/v1/booking-widget/services',
  RESOURCES: (serviceId: string): string => `/v1/booking-widget/resources?serviceId=${encodeURIComponent(serviceId)}`,
  AVAILABILITY: ({
    serviceId,
    resourceId,
    from,
    to,
  }: {
    serviceId: string
    resourceId: string
    from: string
    to: string
  }): string => {
    const query = new URLSearchParams({ serviceId, resourceId, from, to })
    return `/v1/booking-widget/availability?${query.toString()}`
  },
  BOOKINGS: '/v1/booking-widget/bookings',
} as const

export const WIDGET_STEP = {
  SERVICE: 'service',
  RESOURCE: 'resource',
  SLOT: 'slot',
  DETAILS: 'details',
  CONFIRMED: 'confirmed',
} as const

/** Janela de busca de horários disponíveis a partir de agora. */
export const AVAILABILITY_WINDOW_DAYS = 14

/** Mapa de token de tema (chave estável do atributo) para a variável CSS que ele alimenta. */
export const THEME_TOKEN_TO_CSS_VAR: Readonly<Record<string, string>> = {
  primaryColor: '--ada-booking-primary',
  primaryContrastColor: '--ada-booking-primary-contrast',
  surfaceColor: '--ada-booking-surface',
  backgroundColor: '--ada-booking-bg',
  textColor: '--ada-booking-text',
  mutedColor: '--ada-booking-muted',
  borderColor: '--ada-booking-border',
  radius: '--ada-booking-radius',
}
