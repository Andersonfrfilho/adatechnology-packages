/**
 * Capacidade **comportamental** do canal (RF10, D3): confirma leitura, tem janela de sessão (e de
 * quantas horas), aceita anexo e de que tamanho, aceita áudio, aceita resposta rápida, precisa de
 * transporte próprio. Vem de `@adatechnology/conversation-contracts`, nunca redeclarada aqui — é a
 * "duas verdades sobre capacidade de canal" que o plano da spec 211 lista como risco.
 *
 * `messenger` e `instagram` são os dois canais que esta UI já servia antes do núcleo de conversa
 * existir, e que o contrato não conhece (ele nasceu do que a spec 183 exercitava: `email`,
 * `whatsapp`, `app`, `portal`, `webchat`). Convivência decidida aqui: o vocabulário de canal desta
 * UI (`conversationChannel.ts`) é a união dos dois, e a capacidade comportamental de Messenger e
 * Instagram cai no fallback do WhatsApp — o outro canal da Meta, com a mesma janela de 24h, a mesma
 * confirmação de leitura e o mesmo anexo/áudio. Não é aproximação arbitrária: as três plataformas
 * (WhatsApp, Messenger, Instagram) compartilham a política de sessão de 24h da Meta.
 */
import {
  CHANNEL_CAPABILITIES as CORE_CHANNEL_CAPABILITIES,
  CONVERSATION_CHANNEL as CORE_CONVERSATION_CHANNEL,
  type ChannelCapability,
  type ConversationChannel as CoreConversationChannel,
} from '@adatechnology/conversation-contracts'

import { DEFAULT_CONVERSATION_CHANNEL, type ConversationChannel } from './conversationChannel'

const CORE_CHANNELS: readonly string[] = CORE_CONVERSATION_CHANNEL

function isCoreChannel(channel: ConversationChannel): channel is ConversationChannel & CoreConversationChannel {
  return CORE_CHANNELS.includes(channel)
}

/** Fallback documentado para os canais da Meta que o contrato ainda não descreve. */
const META_ONLY_CHANNEL_CAPABILITY: ChannelCapability = CORE_CHANNEL_CAPABILITIES.whatsapp

export function channelCapabilityFor(channel: ConversationChannel | undefined): ChannelCapability {
  const resolved = channel ?? DEFAULT_CONVERSATION_CHANNEL

  return isCoreChannel(resolved) ? CORE_CHANNEL_CAPABILITIES[resolved] : META_ONLY_CHANNEL_CAPABILITY
}
