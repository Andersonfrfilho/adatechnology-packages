/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  CONVERSATION_CHANNEL,
  MESSAGE_DIRECTION,
  MESSAGE_DELIVERY_STATUS,
  DKIM_RESULT,
  ATTACHMENT_KIND,
  conversationChannelSchema,
  messageDirectionSchema,
  messageDeliveryStatusSchema,
  dkimResultSchema,
  attachmentKindSchema,
} from './vocabulary'
export type {
  ConversationChannel,
  MessageDirection,
  MessageDeliveryStatus,
  DkimResult,
  AttachmentKind,
} from './vocabulary'

export { CHANNEL_CAPABILITIES, getChannelCapabilities } from './channelCapabilities'
export type { AttachmentCapability, AudioCapability, ChannelCapability } from './channelCapabilities'

export { advanceDeliveryStatus } from './deliveryStatus'
export type { DeliveryStatusState, DeliveryStatusEvent, DeliveryStatusResult } from './deliveryStatus'

export {
  openConversationParticipantSchema,
  openConversationBodySchema,
  sendMessageBodySchema,
  markConversationReadBodySchema,
  quickReplyBodySchema,
} from './requestSchemas'
export type { OpenConversationBody, SendMessageBody, MarkConversationReadBody, QuickReplyBody } from './requestSchemas'

export type {
  SendConversationTextInput,
  SendConversationAttachmentInput,
  ConversationChannelSendResult,
  ConversationChannelPort,
  DeriveEmailReplyAddressInput,
  VerifyEmailReplyTokenInput,
  SendConversationEmailInput,
  SendConversationEmailResult,
  RecordRawInboundEmailInput,
  RecordRawInboundEmailResult,
  VerifyEmailDkimInput,
  ConversationEmailTransportPort,
  ConversationEmailTransport,
  ConversationEmailReplyAddressPort,
  ConversationEmailSenderPort,
  ConversationEmailInboundPort,
  ClockPort,
  PutConversationObjectInput,
  ConversationObjectLocation,
  CreateSignedConversationObjectUrlInput,
  CreateSignedConversationDownloadUrlInput,
  CreateSignedConversationUploadUrlInput,
  ObjectStoragePort,
  TranscribeAudioInput,
  TranscribeAudioResult,
  TranscriberPort,
} from './ports'
