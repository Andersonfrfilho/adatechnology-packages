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
 * D5: o transporte que a spec 143 provou necessário, em três capacidades separadas — **porque num
 * produto real elas não moram no mesmo processo**. No consumidor de origem, quem deriva o endereço
 * de resposta é a API, quem entrega o e-mail é o relay da fila, e quem baixa o MIME e verifica o
 * DKIM é o worker que consome o webhook. Um transporte único obrigaria cada processo a implementar
 * métodos que ele não tem como implementar, e o que se implementa nesse caso é um `throw` — foi
 * assim que a falta de `contentType` na URL assinada apareceu.
 *
 * O endereço de resposta é a capacidade que **todo** processo que liga o canal precisa ter: é ela
 * que faz a resposta voltar para a conversa certa, e é o que a D5 protege.
 */
export type ConversationEmailReplyAddressPort = {
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
}

/** Quem entrega o e-mail — no consumidor de origem, o relay que drena a fila de saída. */
export type ConversationEmailSenderPort = {
  sendEmail(input: SendConversationEmailInput): Promise<SendConversationEmailResult>
}

/** Quem recebe: baixa o MIME e lê o veredito de DKIM. Vive onde o webhook é consumido. */
export type ConversationEmailInboundPort = {
  /** Grava o MIME bruto e devolve o `sha256` **antes** de qualquer interpretação do conteúdo. */
  recordRawInboundEmail(input: RecordRawInboundEmailInput): Promise<RecordRawInboundEmailResult>
  verifyDkim(input: VerifyEmailDkimInput): Promise<DkimResult>
}

/** As três juntas, para o host que faz tudo num processo só. */
export type ConversationEmailTransportPort = ConversationEmailReplyAddressPort &
  ConversationEmailSenderPort &
  ConversationEmailInboundPort

/**
 * O que um processo fornece ao ligar o canal `email`: sempre o endereço de resposta, e as outras
 * capacidades conforme o que aquele processo faz. Pedir uma capacidade ausente é erro tipado do
 * módulo na hora do uso, nunca um `throw` escondido dentro de um adaptador do host.
 */
export type ConversationEmailTransport = ConversationEmailReplyAddressPort &
  Partial<ConversationEmailSenderPort & ConversationEmailInboundPort>

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
 * A URL assinada de subida **amarra o que vai subir**: tipo e tamanho exatos daquele pedido, não um
 * teto do bucket. Sem isso, quem tem a URL sobe qualquer coisa, de qualquer tamanho, até ela
 * expirar — a conferência de bytes na ligação do anexo recusa o arquivo depois, mas o objeto já
 * entrou no bucket. É o que o produto de origem sempre assinou, e o que o provedor de storage pede.
 */
export type CreateSignedConversationUploadUrlInput = CreateSignedConversationObjectUrlInput & {
  readonly contentType: string
  readonly contentLength: number
}

/** Baixar leva `filename` e `disposition`, que é o que decide abrir na aba ou salvar. */
export type CreateSignedConversationDownloadUrlInput = CreateSignedConversationObjectUrlInput & {
  readonly disposition: 'attachment' | 'inline'
  readonly fileName: string
}

/**
 * Nomes espelham `object-storage-provider` (não importado — este pacote não depende dele; RF4).
 */
export type ObjectStoragePort = {
  put(input: PutConversationObjectInput): Promise<void>
  get(input: ConversationObjectLocation): Promise<ReadableStream<Uint8Array>>
  delete(input: ConversationObjectLocation): Promise<void>
  createSignedDownload(input: CreateSignedConversationDownloadUrlInput): Promise<URL>
  createSignedUpload(input: CreateSignedConversationUploadUrlInput): Promise<URL>
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
