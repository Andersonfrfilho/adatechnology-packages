/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo (T206, RF6, RNF2). **Porta ausente desliga o recurso** (ADR-0051 §4):
 * não há flag `hasX` em lugar nenhum daqui — o que decide se um canal/recurso existe é a presença
 * da porta correspondente em `providers`. `email` é tratado à parte (D5): ele não é um membro comum
 * de `providers.channels` porque o transporte de e-mail tem forma própria
 * (`ConversationEmailTransportPort`, com assunto e threading) — por ora `email` só entra em
 * `enabledChannels` se `providers.emailTransport` vier. A exigência "email ligado sem transporte
 * falha na subida" é da T309/T310, não desta task. `providers.objectStorage` ausente desliga
 * anexo (RF8): os três casos de uso de anexo lançam `AttachmentsDisabledError` na primeira
 * chamada — nunca um `if (module.attachments)` no host.
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
import { UnassignedRepository } from './repositories/UnassignedRepository'
import { QuickReplyRepository } from './repositories/QuickReplyRepository'
import { OpenConversationUseCase } from './use-cases/Conversation.use-cases'
import {
  ListConversationMessagesUseCase,
  ReceiveMessageUseCase,
  SendMessageUseCase,
  UpdateMessageStatusUseCase,
} from './use-cases/Message.use-cases'
import { MarkConversationReadUseCase } from './use-cases/Read.use-cases'
import {
  AssignUnassignedToConversationUseCase,
  AttributeInboundMessageUseCase,
} from './use-cases/Attribution.use-cases'
import type { FilterConversationCandidatesPort } from './use-cases/Attribution.types'
import { AttachmentRepository } from './repositories/AttachmentRepository'
import {
  CreateAttachmentDownloadUrlUseCase,
  LinkAttachmentUploadsUseCase,
  RequestAttachmentUploadUseCase,
} from './use-cases/Attachment.use-cases'
import {
  CreateQuickReplyUseCase,
  ListAllQuickRepliesUseCase,
  ListQuickRepliesForComposerUseCase,
  UpdateQuickReplyUseCase,
} from './use-cases/QuickReply.use-cases'
import { ConfigMissingError } from './errors'

/** Canal comum, enviado por `ConversationChannelPort` — `email` fica de fora (D5). */
type NonEmailChannel = Exclude<ConversationChannel, 'email'>

export type ConversationModuleConfig = {
  /**
   * Obrigatório só quando `providers.objectStorage` vem preenchido — é onde o pedido e a cópia
   * final do anexo (RF8) são gravados. Sem `objectStorage`, o campo nunca é lido.
   */
  readonly attachmentsBucket?: string
}

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
  /** RF7: regra do produto para "atribuível" entre candidatas — ausente, todas contam. */
  readonly filterCandidates?: FilterConversationCandidatesPort
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
    readonly attributeInboundMessage: AttributeInboundMessageUseCase
    readonly assignUnassignedToConversation: AssignUnassignedToConversationUseCase
    readonly requestAttachmentUpload: RequestAttachmentUploadUseCase
    readonly linkAttachmentUploads: LinkAttachmentUploadsUseCase
    readonly createAttachmentDownloadUrl: CreateAttachmentDownloadUrlUseCase
    readonly createQuickReply: CreateQuickReplyUseCase
    readonly listAllQuickReplies: ListAllQuickRepliesUseCase
    readonly listQuickRepliesForComposer: ListQuickRepliesForComposerUseCase
    readonly updateQuickReply: UpdateQuickReplyUseCase
  }
}

export function createConversationModule(params: CreateConversationModuleParams): ConversationModule {
  const { providers } = params
  if (providers.objectStorage && !params.config?.attachmentsBucket) {
    throw new ConfigMissingError('attachmentsBucket')
  }

  const conversations = new ConversationRepository(providers.db)
  const messages = new MessageRepository(providers.db)
  const reads = new ReadRepository(providers.db)
  const unassigned = new UnassignedRepository(providers.db)
  const attachments = new AttachmentRepository(providers.db)
  const quickReplies = new QuickReplyRepository(providers.db)

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
      attributeInboundMessage: new AttributeInboundMessageUseCase({
        conversations,
        messages,
        unassigned,
        clock: providers.clock,
        filterCandidates: providers.filterCandidates,
      }),
      assignUnassignedToConversation: new AssignUnassignedToConversationUseCase({
        conversations,
        messages,
        unassigned,
        clock: providers.clock,
      }),
      requestAttachmentUpload: new RequestAttachmentUploadUseCase({
        attachments,
        objectStorage: providers.objectStorage,
        clock: providers.clock,
        bucket: params.config?.attachmentsBucket ?? '',
      }),
      linkAttachmentUploads: new LinkAttachmentUploadsUseCase({
        attachments,
        objectStorage: providers.objectStorage,
        clock: providers.clock,
      }),
      createAttachmentDownloadUrl: new CreateAttachmentDownloadUrlUseCase({
        attachments,
        objectStorage: providers.objectStorage,
      }),
      createQuickReply: new CreateQuickReplyUseCase({
        quickReplies,
        clock: providers.clock,
      }),
      listAllQuickReplies: new ListAllQuickRepliesUseCase({
        quickReplies,
      }),
      listQuickRepliesForComposer: new ListQuickRepliesForComposerUseCase({
        quickReplies,
      }),
      updateQuickReply: new UpdateQuickReplyUseCase({
        quickReplies,
        clock: providers.clock,
      }),
    },
  }
}
