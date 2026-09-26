/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo (T206, RF6, RNF2). **Porta ausente desliga o recurso** (ADR-0051 §4):
 * não há flag `hasX` em lugar nenhum daqui — o que decide se um canal/recurso existe é a presença
 * da porta correspondente em `providers`. `email` é tratado à parte (D5): ele não é um membro comum
 * de `providers.channels` porque o transporte de e-mail tem forma própria
 * (`ConversationEmailTransportPort`, com assunto e threading) — por ora `email` só entra em
 * `enabledChannels` se `providers.emailTransport` vier. A exigência "email ligado sem transporte
 * falha na subida" é da T309/T310, não desta task. Anexo (T209/T210), atribuição genérica
 * (T207/T208) e respostas rápidas (T211) chegam nas próximas tasks — os repositórios delas ainda
 * não são instanciados aqui de propósito, para o factory não carregar dependência que nenhum
 * caso de uso desta task consome.
 */
import type {
  ClockPort,
  ConversationChannel,
  ConversationChannelPort,
  ConversationEmailTransportPort,
  ObjectStoragePort,
  TranscriberPort,
} from '@adatechnology/conversation-contracts'

import type { ConversationDatabase } from './database.types'
import { ConversationRepository } from './repositories/ConversationRepository'
import { MessageRepository } from './repositories/MessageRepository'
import { ReadRepository } from './repositories/ReadRepository'
import { OpenConversationUseCase } from './use-cases/Conversation.use-cases'
import {
  ListConversationMessagesUseCase,
  ReceiveMessageUseCase,
  SendMessageUseCase,
  UpdateMessageStatusUseCase,
} from './use-cases/Message.use-cases'
import { MarkConversationReadUseCase } from './use-cases/Read.use-cases'

/** Canal comum, enviado por `ConversationChannelPort` — `email` fica de fora (D5). */
type NonEmailChannel = Exclude<ConversationChannel, 'email'>

/** Reservada para configuração futura; vazia hoje — nada aqui liga ou desliga recurso (ver `providers`). */
export type ConversationModuleConfig = Record<string, never>

/**
 * Reservada para toggles que não sejam gate de porta. Vazia hoje de propósito — o que liga/desliga
 * canal e recurso é sempre a porta em `providers`, nunca um campo aqui ("nunca flag hasX").
 */
export type ConversationModuleFeatures = Record<string, never>

export type ConversationModuleProviders = {
  readonly db: ConversationDatabase
  readonly clock: ClockPort
  readonly channels: Partial<Record<NonEmailChannel, ConversationChannelPort>>
  readonly emailTransport?: ConversationEmailTransportPort
  readonly objectStorage?: ObjectStoragePort
  readonly transcriber?: TranscriberPort
}

export type CreateConversationModuleParams = {
  readonly config?: ConversationModuleConfig
  readonly features?: ConversationModuleFeatures
  readonly providers: ConversationModuleProviders
}

export type ConversationModule = {
  /** Os canais que o módulo de fato alcança, derivados das portas recebidas — nunca de uma flag. */
  readonly enabledChannels: readonly ConversationChannel[]
  readonly useCases: {
    readonly openConversation: OpenConversationUseCase
    readonly sendMessage: SendMessageUseCase
    readonly receiveMessage: ReceiveMessageUseCase
    readonly updateMessageStatus: UpdateMessageStatusUseCase
    readonly listConversationMessages: ListConversationMessagesUseCase
    readonly markConversationRead: MarkConversationReadUseCase
  }
}

export function createConversationModule(params: CreateConversationModuleParams): ConversationModule {
  const { providers } = params

  const conversations = new ConversationRepository(providers.db)
  const messages = new MessageRepository(providers.db)
  const reads = new ReadRepository(providers.db)

  const enabledChannels: ConversationChannel[] = [
    ...(Object.keys(providers.channels) as NonEmailChannel[]),
    ...(providers.emailTransport ? (['email'] as const) : []),
  ]

  return {
    enabledChannels,
    useCases: {
      openConversation: new OpenConversationUseCase({ conversations }),
      sendMessage: new SendMessageUseCase({ messages, channels: providers.channels, clock: providers.clock }),
      receiveMessage: new ReceiveMessageUseCase({ messages }),
      updateMessageStatus: new UpdateMessageStatusUseCase({ messages }),
      listConversationMessages: new ListConversationMessagesUseCase({ messages }),
      markConversationRead: new MarkConversationReadUseCase({ reads, messages, clock: providers.clock }),
    },
  }
}
