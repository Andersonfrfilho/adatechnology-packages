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
}

/** O que a tela de cadastro manda para criar ou atualizar; o `id` é do servidor. */
export type QuickReplyInput = {
  readonly title: string
  readonly shortcut: string
  readonly body: string
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
