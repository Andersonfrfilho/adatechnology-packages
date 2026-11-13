import { describe, expect, it } from 'bun:test'

import { EMAIL_ATTACHMENT_MAX_BYTES, EMAIL_ATTACHMENT_MAX_COUNT, checkEmailAttachment } from './emailAttachment'
import type { EmailAttachment } from './emailAttachment'

const VALID: EmailAttachment = {
  filename: 'nota-fiscal.pdf',
  url: 'https://storage.exemplo.com/notas/abc?assinatura=x',
  contentType: 'application/pdf',
}

describe('checkEmailAttachment', () => {
  it('aprova o anexo bem formado', () => {
    expect(checkEmailAttachment(VALID)).toBeUndefined()
  })

  /** O nome vai para o cabecalho MIME e, do outro lado, para o disco de quem salva. */
  it.each(['../../etc/passwd', 'pasta/nota.pdf', 'pasta\\nota.pdf'])(
    'recusa travessia de diretorio no nome: %j',
    (filename) => {
      expect(checkEmailAttachment({ ...VALID, filename })).toBe('ATTACHMENT_FILENAME_UNSAFE')
    },
  )

  it('recusa nome vazio ou so espaco', () => {
    expect(checkEmailAttachment({ ...VALID, filename: '   ' })).toBe('ATTACHMENT_FILENAME_EMPTY')
  })

  /** `file:` puxaria do disco do servidor; `data:` inflaria a mensagem; `http:` trafega em claro. */
  it.each([
    ['file:///etc/passwd'],
    ['data:application/pdf;base64,AAA'],
    ['/relativo.pdf'],
    ['nem-url'],
    // "Rede interna" e promessa de topologia que este pacote nao tem como verificar.
    ['http://storage.interno/x.pdf'],
    ['http://192.168.0.10/x.pdf'],
  ])('exige https fora de loopback: %j', (url) => {
    expect(checkEmailAttachment({ ...VALID, url })).toBe('ATTACHMENT_URL_NOT_HTTPS')
  })

  /**
   * Loopback nao e a internet: o pacote nunca sai da maquina. Sem esta excecao, todo ambiente local
   * com MinIO em `http://localhost` reprova o anexo antes de qualquer teste.
   */
  it.each([
    ['http://localhost:9004/bucket/objeto'],
    ['http://127.0.0.1:9004/bucket/objeto'],
    ['http://[::1]:9004/bucket/objeto'],
  ])('aceita http em loopback: %j', (url) => {
    expect(checkEmailAttachment({ ...VALID, url })).toBeUndefined()
  })

  it('exige contentType declarado, porque extensao mente', () => {
    expect(checkEmailAttachment({ ...VALID, contentType: '' })).toBe('ATTACHMENT_CONTENT_TYPE_EMPTY')
  })

  it('devolve o motivo em vez de lancar: a entrega registra a causa da recusa', () => {
    expect(() => checkEmailAttachment({ ...VALID, url: 'ftp://x' })).not.toThrow()
  })

  it('os tetos existem e sao os do que Gmail e Outlook aceitam', () => {
    expect(EMAIL_ATTACHMENT_MAX_BYTES).toBe(26_214_400)
    expect(EMAIL_ATTACHMENT_MAX_COUNT).toBe(10)
  })
})
