/**
 * Marca visual de cada canal.
 *
 * SVG em vez de emoji porque emoji não tem logo de marca: 💬 e 📨 não distinguem WhatsApp de
 * Messenger para quem bate o olho numa fila de conversas. São marcas **simplificadas** desenhadas
 * com primitivas — reconhecíveis pela forma e pela cor oficial, sem reproduzir o logotipo original.
 *
 * `currentColor` não serve aqui: a cor faz parte da identificação do canal.
 */

import { CONVERSATION_CHANNEL, capabilitiesOf, type ConversationChannel } from './conversationChannel'

export const CHANNEL_BRAND_COLOR: Readonly<Record<ConversationChannel, string>> = {
  [CONVERSATION_CHANNEL.WHATSAPP]: '#25D366',
  [CONVERSATION_CHANNEL.MESSENGER]: '#0084FF',
  [CONVERSATION_CHANNEL.INSTAGRAM]: '#E4405F',
  [CONVERSATION_CHANNEL.WEBCHAT]: '#64748B',
}

export interface ChannelIconProps {
  channel?: ConversationChannel | undefined
  size?: number
  className?: string
}

function Glyph({ channel }: { channel: ConversationChannel }) {
  const color = CHANNEL_BRAND_COLOR[channel]

  if (channel === CONVERSATION_CHANNEL.WHATSAPP) {
    return (
      <>
        <circle cx="12" cy="12" r="11" fill={color} />
        {/* Handset estilizado, o traço que identifica a marca à distância. */}
        <path
          d="M8.6 7.2c.3-.1.7 0 .9.3l1 1.6c.2.3.1.7-.1.9l-.7.7c.6 1.3 1.6 2.3 2.9 2.9l.7-.7c.2-.2.6-.3.9-.1l1.6 1c.3.2.4.6.3.9-.4 1-1.4 1.6-2.4 1.4-3-.5-5.4-2.9-5.9-5.9-.2-1 .4-2 1.4-2.4Z"
          fill="#fff"
        />
      </>
    )
  }

  if (channel === CONVERSATION_CHANNEL.MESSENGER) {
    return (
      <>
        <circle cx="12" cy="12" r="11" fill={color} />
        {/* Raio do Messenger. */}
        <path d="M6.5 15.5 11 10.8l2.4 2.4L17.5 9l-4.6 4.9-2.4-2.4-4 4Z" fill="#fff" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </>
    )
  }

  if (channel === CONVERSATION_CHANNEL.INSTAGRAM) {
    return (
      <>
        <rect x="2" y="2" width="20" height="20" rx="6" fill={color} />
        <rect x="6.5" y="6.5" width="11" height="11" rx="3.5" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="16.4" cy="7.6" r="1" fill="#fff" />
      </>
    )
  }

  return (
    <>
      <circle cx="12" cy="12" r="11" fill={color} />
      <path d="M6.5 8.5h11v7h-5.5L8.5 18v-2.5h-2v-7Z" fill="#fff" />
    </>
  )
}

export function ChannelIcon({ channel, size = 14, className = '' }: ChannelIconProps) {
  const resolved: ConversationChannel = channel ?? CONVERSATION_CHANNEL.WHATSAPP
  const { label } = capabilitiesOf(resolved)

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      <Glyph channel={resolved} />
    </svg>
  )
}
