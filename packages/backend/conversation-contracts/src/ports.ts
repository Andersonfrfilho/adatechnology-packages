/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF4: só assinatura, sem comportamento de runtime — quem implementa é o host
 * (`conversation-module` ou o produto). D5: ligar um canal sem fornecer a porta que ele exige é
 * erro na subida, nomeando a peça que falta; a checagem em si é do módulo stateful, não deste
 * pacote.
 */
import type { ConversationChannel, DkimResult } from './vocabulary'

export type SendConversationTextInput = {
  readonly channel: ConversationChannel
  /** Endereço ou identificador do destinatário no canal — opaco para o núcleo. */
  readonly to: string
  /** O id da nossa mensagem, para o canal correlacionar (ex.: `Idempotency-Key`). */
  readonly messageId: string
  readonly bodyText: string
}

export type SendConversationAttachmentInput = {
  readonly channel: ConversationChannel
  readonly to: string
  readonly messageId: string
  readonly contentType: string
  readonly bytes: Uint8Array
  readonly fileName: string
}

export type ConversationChannelSendResult = {
  /** Id opaco que o provedor do canal devolveu — nunca interpretado pelo núcleo. */
  readonly providerMessageId: string
}

/** Enviar texto ou anexo por um canal. Implementado por canal (WhatsApp, app, portal, webchat). */
export type ConversationChannelPort = {
  sendText(input: SendConversationTextInput): Promise<ConversationChannelSendResult>
  sendAttachment(input: SendConversationAttachmentInput): Promise<ConversationChannelSendResult>
}

export type DeriveEmailReplyAddressInput = {
  readonly companyId: string
  readonly conversationId: string
}

export type VerifyEmailReplyTokenInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly token: string
}

export type SendConversationEmailInput = {
  readonly companyId: string
  /** O id da nossa mensagem — vira o `Idempotency-Key` do envio. */
  readonly messageId: string
  readonly fromAddress: string
  readonly toAddresses: readonly string[]
  readonly subject: string
  readonly bodyText: string
  readonly bodyHtml?: string
  /** Threading RFC 5322 — presentes quando a mensagem responde a uma anterior. */
  readonly inReplyTo?: string
  readonly references?: readonly string[]
}

export type SendConversationEmailResult = {
  readonly providerMessageId: string
}

export type RecordRawInboundEmailInput = {
  readonly rawMime: Uint8Array
}

export type RecordRawInboundEmailResult = {
  /** O hash dos bytes exatamente como chegaram, calculado antes de qualquer interpretação. */
  readonly sha256: string
}

export type VerifyEmailDkimInput = {
  readonly rawMime: Uint8Array
  readonly fromAddress: string
}

/**
 * D5: o transporte que a spec 143 provou necessário. `replyAddressPrefix` é parâmetro do host
 * (era fixo `transportada` na origem) — trocá-lo troca todo endereço de resposta em uso.
 */
export type ConversationEmailTransportPort = {
  /**
   * `token = base32lower(HMAC-SHA256(replyTokenSecret,
   * "<replyAddressPrefix>:v1:" + companyId + ":" + conversationId))[:128 bits]`, embutido no
   * endereço de resposta. Determinístico: a mesma conversa sempre deriva o mesmo endereço.
   */
  deriveReplyAddress(input: DeriveEmailReplyAddressInput): string
  /**
   * Confere, por comparação de tempo constante, se `token` é o que `(companyId, conversationId)`
   * derivaria — HMAC não se inverte; quem sabe a **qual** conversa um endereço recebido pertence é
   * o host, pela busca de candidatas por hash (como `findThreadByReplyTokenHash` da 143). Esta
   * porta só confirma a candidata.
   */
  verifyReplyToken(input: VerifyEmailReplyTokenInput): boolean
  sendEmail(input: SendConversationEmailInput): Promise<SendConversationEmailResult>
  /** Grava o MIME bruto e devolve o `sha256` **antes** de qualquer interpretação do conteúdo. */
  recordRawInboundEmail(input: RecordRawInboundEmailInput): Promise<RecordRawInboundEmailResult>
  verifyDkim(input: VerifyEmailDkimInput): Promise<DkimResult>
}

export type ClockPort = {
  now(): Date
}

export type PutConversationObjectInput = {
  readonly bucket: string
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: string
  readonly sha256: string
}

export type ConversationObjectLocation = {
  readonly bucket: string
  readonly key: string
}

export type CreateSignedConversationObjectUrlInput = ConversationObjectLocation & {
  readonly expiresInSeconds: number
}

/**
 * Nomes espelham `object-storage-provider` (não importado — este pacote não depende dele; RF4).
 */
export type ObjectStoragePort = {
  put(input: PutConversationObjectInput): Promise<void>
  get(input: ConversationObjectLocation): Promise<ReadableStream<Uint8Array>>
  delete(input: ConversationObjectLocation): Promise<void>
  createSignedDownload(input: CreateSignedConversationObjectUrlInput): Promise<URL>
  createSignedUpload(input: CreateSignedConversationObjectUrlInput): Promise<URL>
}

export type TranscribeAudioInput = {
  readonly bytes: Uint8Array
  readonly contentType: string
}

export type TranscribeAudioResult = {
  readonly text: string
}

/** Opcional (ADR-0074): porta ausente é anexo de áudio sem texto, nunca texto fingido. */
export type TranscriberPort = {
  transcribe(input: TranscribeAudioInput): Promise<TranscribeAudioResult>
}
