import { createHash } from 'node:crypto'

const HASH_LENGTH = 16

/**
 * Chave de log derivada do `wamid`, porque o `wamid` não pode ir para o log.
 *
 * Ele parece um identificador opaco e não é: `wamid.HBgNNTUxNjk5MzA1Njc3MhUC...` é base64, e o que
 * está codificado ali dentro é o telefone do destinatário em claro. Logar o id cru publica o
 * número do cliente numa linha onde ninguém procura por PII — o campo nem tem nome de telefone.
 *
 * O hash preserva o que o log precisa e descarta o que ele não pode ter: a mesma mensagem produz
 * sempre a mesma chave, então os vários webhooks de status de um envio só continuam se juntando.
 * Para achar a linha no banco a partir do log, hasheia-se o `wa_message_id` candidato.
 */
export function hashWaMessageId(waMessageId: string | undefined): string | undefined {
  if (waMessageId === undefined) return undefined

  return createHash('sha256').update(waMessageId).digest('hex').slice(0, HASH_LENGTH)
}
