/**
 * Guarda o rótulo de tipo da bolha de documento.
 *
 * O defeito que motivou: `mimeType.split('/')[1].toUpperCase()` transformava um `.docx` em
 * `VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT` — 58 caracteres numa linha que não
 * quebra, esticando a bolha até empurrar a coluna da conversa e estourar o layout de três painéis.
 */

import { describe, expect, it } from 'bun:test'

import { documentTypeLabel } from './MediaRenderer'

describe('documentTypeLabel', () => {
  // O caso que quebrou a tela.
  it('usa a extensão do arquivo em vez do subtipo gigante do Office', () => {
    const rotulo = documentTypeLabel(
      'contrato.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )

    expect(rotulo).toBe('DOCX')
  })

  it('serve para os tipos curtos também', () => {
    expect(documentTypeLabel('nota-fiscal.pdf', 'application/pdf')).toBe('PDF')
    expect(documentTypeLabel('lista.txt', 'text/plain')).toBe('TXT')
  })

  // Áudio e sticker chegam sem nome de arquivo: o rótulo vem do mimeType, ainda curto.
  it('cai no sufixo do subtipo quando não há nome', () => {
    expect(documentTypeLabel(undefined, 'application/vnd.ms-excel')).toBe('MS-EXCEL')
    expect(documentTypeLabel(undefined, 'application/pdf')).toBe('PDF')
  })

  it('descarta parâmetro do mimeType', () => {
    expect(documentTypeLabel(undefined, 'audio/ogg; codecs=opus')).toBe('OGG')
  })

  // Nome sem ponto não tem extensão — o id da mídia, por exemplo.
  it('não confunde nome sem extensão com extensão', () => {
    expect(documentTypeLabel('seed-media-03', 'application/zip')).toBe('ZIP')
  })

  it('tem rótulo para o caso sem nome e sem tipo', () => {
    expect(documentTypeLabel()).toBe('FILE')
  })

  // Teto de tamanho: nenhum rótulo pode voltar a esticar a bolha.
  it('nunca passa de 12 caracteres', () => {
    const longo = documentTypeLabel(
      undefined,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )

    expect(longo.length).toBeLessThanOrEqual(12)
  })
})
