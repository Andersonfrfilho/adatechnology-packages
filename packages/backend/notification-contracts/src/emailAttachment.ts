/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Anexo de e-mail — por REFERÊNCIA, nunca por conteúdo.
 *
 * O template é linha versionada no Postgres e o job é payload no Redis. Um PDF em qualquer um dos
 * dois é blob replicado a cada versão e a cada tentativa, e uma nota fiscal é dado pessoal — o
 * `security.md` §6 já manda o payload de fila carregar referência, e o §7 manda entregar arquivo por
 * URL assinada de vida curta. Anexo segue a mesma regra: o que trafega é onde o arquivo está.
 *
 * Quem baixa é o DRIVER, no momento do envio, e é ele que aplica o teto de tamanho. Baixar antes
 * (no módulo) seria carregar bytes na memória de um processo que pode nem chegar a enviar.
 */

/**
 * 25MB é o teto prático: Gmail e Outlook recusam acima disso, e o SES conta o MIME inteiro já em
 * base64 — que infla ~33%. O driver reprova ANTES de montar a mensagem, senão o erro vem do
 * provedor como uma falha genérica de envio.
 */
export const EMAIL_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024

/** Um e-mail com trinta anexos é engano de laço, não um caso de uso. */
export const EMAIL_ATTACHMENT_MAX_COUNT = 10

export type EmailAttachment = {
  /** O nome que o destinatário vê. Sem caminho: `../` num nome de anexo é travessia de diretório. */
  readonly filename: string
  /**
   * URL de onde o driver baixa no momento do envio. Assinada e de vida curta quando o arquivo for
   * privado — o driver não autentica, ele só faz `GET`.
   */
  readonly url: string
  /** Declarado pelo produto, e não adivinhado da extensão: extensão mente, e cliente de e-mail confia. */
  readonly contentType: string
}

/**
 * Recusa o que não pode virar anexo antes de qualquer rede.
 *
 * Devolve o motivo em vez de lançar: o chamador é um driver, e uma tentativa de entrega registra o
 * porquê da recusa na `delivery` — `throw` viraria erro genérico e o operador ficaria sem a causa.
 */
export function checkEmailAttachment(attachment: EmailAttachment): string | undefined {
  if (!attachment.filename.trim()) return 'ATTACHMENT_FILENAME_EMPTY'

  // Travessia de diretório: o nome vai para o cabeçalho MIME e, do outro lado, para o disco de quem
  // salva. `/`, `\` e `..` não têm por que existir num nome de arquivo anexado.
  if (/[/\\]|\.\./.test(attachment.filename)) return 'ATTACHMENT_FILENAME_UNSAFE'

  if (!attachment.contentType.trim()) return 'ATTACHMENT_CONTENT_TYPE_EMPTY'

  // Só `https`: `file:`, `data:` e `http:` puxariam do disco do servidor, inflariam a mensagem ou
  // trafegariam um documento pessoal em claro.
  if (!attachment.url.startsWith('https://')) return 'ATTACHMENT_URL_NOT_HTTPS'

  return undefined
}
