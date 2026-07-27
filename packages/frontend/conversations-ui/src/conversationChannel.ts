/**
 * Canal de origem da conversa e o que cada um permite.
 *
 * Existe porque as regras que a inbox precisa respeitar não são do WhatsApp, são **de cada canal**:
 * a janela de sessão, o jeito de reabrir a conversa e o formato do identificador do contato mudam
 * entre WhatsApp, Messenger, Instagram e chat de site. Tratar a regra do WhatsApp como universal
 * faria a UI bloquear o composer num chat de site, onde janela nenhuma existe.
 *
 * `whatsapp` é o padrão em todo lugar: instalações que ainda não informam canal continuam
 * funcionando exatamente como antes.
 */

import { formatPhone, phoneCountryFlag } from './lib/phone'

export const CONVERSATION_CHANNEL = {
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  INSTAGRAM: 'instagram',
  WEBCHAT: 'webchat',
} as const
export type ConversationChannel = (typeof CONVERSATION_CHANNEL)[keyof typeof CONVERSATION_CHANNEL]

export const DEFAULT_CONVERSATION_CHANNEL: ConversationChannel = CONVERSATION_CHANNEL.WHATSAPP

/** Como o canal reabre uma conversa fora da janela de sessão. */
export const REOPEN_MECHANISM = {
  TEMPLATE: 'template',
  TAG: 'tag',
  NONE: 'none',
} as const
export type ReopenMechanism = (typeof REOPEN_MECHANISM)[keyof typeof REOPEN_MECHANISM]

/** Natureza do identificador do contato — decide como exibi-lo. */
export const HANDLE_KIND = {
  PHONE: 'phone',
  USERNAME: 'username',
  SESSION: 'session',
} as const
export type HandleKind = (typeof HANDLE_KIND)[keyof typeof HANDLE_KIND]

export type ChannelCapabilities = {
  readonly label: string
  readonly icon: string
  readonly hasSessionWindow: boolean
  readonly windowHours: number
  readonly reopenMechanism: ReopenMechanism
  readonly handleKind: HandleKind
}

export const CHANNEL_CAPABILITIES: Readonly<Record<ConversationChannel, ChannelCapabilities>> = {
  [CONVERSATION_CHANNEL.WHATSAPP]: {
    label: 'WhatsApp',
    icon: '💬',
    hasSessionWindow: true,
    windowHours: 24,
    reopenMechanism: REOPEN_MECHANISM.TEMPLATE,
    handleKind: HANDLE_KIND.PHONE,
  },
  [CONVERSATION_CHANNEL.MESSENGER]: {
    // Messenger também tem 24h, mas reabre com message tag — não com template aprovado.
    label: 'Messenger',
    icon: '📨',
    hasSessionWindow: true,
    windowHours: 24,
    reopenMechanism: REOPEN_MECHANISM.TAG,
    handleKind: HANDLE_KIND.USERNAME,
  },
  [CONVERSATION_CHANNEL.INSTAGRAM]: {
    label: 'Instagram',
    icon: '📷',
    hasSessionWindow: true,
    windowHours: 24,
    reopenMechanism: REOPEN_MECHANISM.TAG,
    handleKind: HANDLE_KIND.USERNAME,
  },
  [CONVERSATION_CHANNEL.WEBCHAT]: {
    // Chat próprio: sem intermediário, sem janela. Bloquear o composer aqui seria inventar limite.
    label: 'Chat do site',
    icon: '🌐',
    hasSessionWindow: false,
    windowHours: 0,
    reopenMechanism: REOPEN_MECHANISM.NONE,
    handleKind: HANDLE_KIND.SESSION,
  },
}

export function capabilitiesOf(channel: ConversationChannel | undefined): ChannelCapabilities {
  return CHANNEL_CAPABILITIES[channel ?? DEFAULT_CONVERSATION_CHANNEL]
}

export const CHANNEL_FILTER_ALL = 'all'
export type ChannelFilter = ConversationChannel | typeof CHANNEL_FILTER_ALL

export type ChannelFilterOption = {
  readonly value: ChannelFilter
  readonly label: string
}

/**
 * Opções derivadas do que existe na lista, não do catálogo inteiro: oferecer Instagram numa conta
 * que só tem WhatsApp promete um recorte que nunca traz resultado.
 *
 * Devolve vazio com menos de dois canais — um filtro de opção única não filtra nada, e a barra só
 * ocuparia espaço. O host usa isso para esconder a seção.
 */
export function channelFiltersFor(
  conversations: readonly { readonly channel?: ConversationChannel | undefined }[],
): ChannelFilterOption[] {
  const present = new Set<ConversationChannel>(
    conversations.map((conversation) => conversation.channel ?? DEFAULT_CONVERSATION_CHANNEL),
  )

  if (present.size < 2) return []

  // Ordem do catálogo, não de chegada: a barra não pode reordenar sozinha a cada refetch.
  const ordered = (Object.keys(CHANNEL_CAPABILITIES) as ConversationChannel[]).filter((channel) => present.has(channel))

  return [
    { value: CHANNEL_FILTER_ALL, label: 'Todos' },
    ...ordered.map((channel) => ({ value: channel, label: CHANNEL_CAPABILITIES[channel].label })),
  ]
}

export type FormatContactHandleParams = {
  readonly handle: string
  readonly channel?: ConversationChannel | undefined
}

/**
 * Exibição do identificador conforme a natureza dele. Formatar tudo como telefone — o que a UI
 * fazia — transforma um `@perfil` do Instagram em dígitos sem sentido.
 */
export function formatContactHandle(params: FormatContactHandleParams): string {
  const { handleKind } = capabilitiesOf(params.channel)

  if (handleKind === HANDLE_KIND.PHONE) return formatPhone(params.handle)
  if (handleKind === HANDLE_KIND.USERNAME) return params.handle.startsWith('@') ? params.handle : `@${params.handle}`

  // Sessão de chat de site é um id opaco: mostrar o hash inteiro não ajuda ninguém.
  return `Visitante ${params.handle.slice(-6)}`
}

/** Bandeira só faz sentido quando o identificador é telefone. */
export function contactFlag(params: FormatContactHandleParams): string {
  return capabilitiesOf(params.channel).handleKind === HANDLE_KIND.PHONE ? phoneCountryFlag(params.handle) : ''
}
