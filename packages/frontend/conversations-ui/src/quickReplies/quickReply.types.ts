/**
 * Mensagem pronta cadastrada pelo produto e oferecida no composer.
 *
 * Difere do `QuickReply` dos chips (`MessageComposer`): aquela vive em código no host; esta vem da
 * API, tem atalho para o `/` e é editada pela tela de cadastro.
 */
export type QuickReply = {
  readonly id: string
  /** Até 40 caracteres — é o que o atendente lê na lista. */
  readonly title: string
  /** Casa `^[a-z0-9-]{1,20}$`: é digitado depois do `/`, sem acento nem espaço. */
  readonly shortcut: string
  /** Até 1000 caracteres, com `{{marcador}}` onde entra o dado da conversa. */
  readonly body: string
  /** Ausente em host sem anexos: o contrato continua o mesmo para quem não os oferece. */
  readonly attachments?: readonly QuickReplyAttachment[]
}

/** Teto de anexos por mensagem pronta — o mesmo que a API aplica, para a tela recusar antes. */
export const QUICK_REPLY_ATTACHMENT_LIMIT = 10

/** Arquivo já guardado pelo host; o `uploadId` é a única chave que o pacote devolve ao servidor. */
export type QuickReplyAttachment = {
  readonly uploadId: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
}

/**
 * Item da fila do composer. `local` ainda não subiu (veio do clipe); `stored` já está no servidor
 * (veio de uma mensagem pronta) e é enviado por referência, sem baixar e subir de novo.
 */
export type QueuedAttachment =
  | { readonly kind: 'local'; readonly file: File }
  | {
      readonly kind: 'stored'
      readonly uploadId: string
      readonly filename: string
      readonly mimeType: string
      readonly sizeBytes: number
      /** Carregada sob demanda só para imagem — a lista não pode abrir N URLs assinadas de uma vez. */
      readonly previewUrl?: string
    }

/** Resultado por arquivo: o envio em lote falha parcialmente, e só o que falhou fica na fila. */
export type StoredAttachmentSendResult = {
  readonly uploadId: string
  readonly status: 'sent' | 'failed' | 'skipped'
  readonly errorCode?: string
}

/** O que a tela de cadastro manda para criar ou atualizar; o `id` é do servidor. */
export type QuickReplyInput = {
  readonly title: string
  readonly shortcut: string
  readonly body: string
  /** Ordem do cadastro é a ordem de envio; ausente não mexe nos anexos já gravados. */
  readonly attachmentUploadIds?: readonly string[]
}

/**
 * Dado da conversa que um texto pode citar. Uma lista só alimenta a prévia, a inserção e o botão de
 * variáveis — antes eram duas props de formato diferente, e as telas divergiam por isso.
 */
export type ConversationVariable = {
  readonly id: string
  /** Rótulo do botão "Inserir variável" (ex.: "Nome do cliente"). */
  readonly label: string
  /** Como aparece no texto: `{{nome}}`. */
  readonly marker: string
  /** Vazio quando a conversa não tem o dado: a variável não é oferecida. */
  readonly value: string
}
