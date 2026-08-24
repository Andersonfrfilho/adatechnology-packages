/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const NOTIFICATION_CHANNEL = {
  INBOX: 'inbox',
  PUSH: 'push',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
} as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL]

/** Canais que interrompem o destinatário e por isso respeitam quiet hours (ver spec §10.4). */
export const INTRUSIVE_CHANNELS: readonly NotificationChannel[] = [
  NOTIFICATION_CHANNEL.PUSH,
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
]

/**
 * O teto de canais da empresa por categoria, acima da preferência do usuário. Linha ausente
 * significa permitido — fechar por omissão calaria toda categoria existente.
 */
export type NotificationCategoryPolicy = {
  readonly category: string
  readonly channel: NotificationChannel
  readonly enabled: boolean
}

export const NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  QUEUED: 'queued',
  DISPATCHED: 'dispatched',
  PARTIALLY_FAILED: 'partially_failed',
  FAILED: 'failed',
} as const
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS]

export const DELIVERY_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  BOUNCED: 'bounced',
  SKIPPED: 'skipped',
} as const
export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS]

export const DEVICE_PLATFORM = {
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web',
} as const
export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM]

export const PUSH_DRIVER = {
  EXPO: 'expo',
  FCM: 'fcm',
} as const
export type PushDriver = (typeof PUSH_DRIVER)[keyof typeof PUSH_DRIVER]

export const EMAIL_DRIVER = {
  SMTP: 'smtp',
  RESEND: 'resend',
  SES: 'ses',
} as const
export type EmailDriver = (typeof EMAIL_DRIVER)[keyof typeof EMAIL_DRIVER]

export const SUPPRESSION_REASON = {
  BOUNCE: 'bounce',
  COMPLAINT: 'complaint',
  OPT_OUT: 'opt_out',
} as const
export type SuppressionReason = (typeof SUPPRESSION_REASON)[keyof typeof SUPPRESSION_REASON]

/**
 * Sugestão de nomenclatura, sem valor normativo (decisão Q2 da spec). `category` é `varchar`
 * livre porque é vocabulário de negócio do produto — fechá-la num enum aqui obrigaria uma major
 * do pacote a cada produto novo.
 */
export const NOTIFICATION_CATEGORY_HINT = {
  ORDER_STATUS: 'order_status',
  PAYMENT: 'payment',
  SECURITY: 'security',
  MARKETING: 'marketing',
  SYSTEM: 'system',
} as const

export type NotificationId = string
export type CompanyId = string
export type UserId = string

export type NotificationSummary = {
  readonly id: NotificationId
  readonly category: string
  readonly templateKey: string
  readonly title: string
  readonly body: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly status: NotificationStatus
  readonly scheduledFor?: string
  readonly readAt?: string
  readonly createdAt: string
}

export type DeliverySummary = {
  readonly id: string
  readonly notificationId: NotificationId
  readonly channel: NotificationChannel
  readonly driver?: string
  /** Nunca o endereço em claro: `****1234`, `a***@dominio.com` (LGPD — ver spec §5). */
  readonly targetMasked?: string
  readonly status: DeliveryStatus
  readonly attempt: number
  readonly providerMessageId?: string
  readonly errorCode?: string
  readonly sentAt?: string
  readonly deliveredAt?: string
  readonly failedAt?: string
}

export type DeviceRegistration = {
  readonly id: string
  readonly platform: DevicePlatform
  readonly driver: PushDriver
  readonly appVersion?: string
  readonly locale?: string
  readonly timezone?: string
  readonly lastSeenAt: string
  readonly disabledAt?: string
  readonly disabledReason?: string
}

export type NotificationPreference = {
  readonly category: string
  readonly channel: NotificationChannel
  readonly enabled: boolean
  /** `HH:mm` no timezone resolvido para o destinatário; ambos ausentes = sem janela de silêncio. */
  readonly quietHoursStart?: string
  readonly quietHoursEnd?: string
  readonly timezone?: string
}

export type NotificationTemplate = {
  readonly id: string
  readonly key: string
  readonly channel: NotificationChannel
  readonly locale: string
  readonly version: number
  readonly subject?: string
  readonly body: string
  /**
   * Nome do template aprovado na Meta. Sem ele, o canal WhatsApp é pulado fora da janela de 24 h
   * em vez de estourar erro na cara do usuário (spec §10.7).
   */
  readonly whatsappTemplateName?: string
  readonly active: boolean
}

export type SendNotificationParams = {
  readonly companyId: CompanyId
  readonly recipientUserId: UserId
  readonly category: string
  readonly templateKey: string
  readonly payload?: Readonly<Record<string, unknown>>
  /** Sem canais explícitos, o fan-out resolve pelas preferências do destinatário. */
  readonly channels?: readonly NotificationChannel[]
  /** Chave de negócio da entrega. Repetição devolve a notificação existente, não uma nova. */
  readonly dedupeKey?: string
  readonly scheduledFor?: Date
  readonly locale?: string
}

export type SendNotificationResult = {
  readonly notificationId: NotificationId
  /** `true` quando um `dedupeKey` já visto devolveu a notificação anterior — nada foi reenviado. */
  readonly deduplicated: boolean
  readonly deliveries: readonly DeliverySummary[]
}

export type ListNotificationsParams = {
  readonly companyId: CompanyId
  readonly recipientUserId: UserId
  readonly category?: string
  readonly read?: boolean
  readonly cursor?: string
  readonly perPage?: number
}

export type ListNotificationsResult = {
  readonly data: readonly NotificationSummary[]
  readonly nextCursor?: string
  readonly unreadCount: number
}

export type DeliveryReceipt = {
  readonly providerMessageId: string
  readonly status: Extract<DeliveryStatus, 'delivered' | 'bounced' | 'failed'>
  readonly errorCode?: string
  readonly occurredAt: Date
  readonly suppressionReason?: SuppressionReason
}
