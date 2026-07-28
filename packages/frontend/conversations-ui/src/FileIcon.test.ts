import { describe, expect, it } from 'bun:test'

import { resolveFileIconExtension } from './FileIcon'

describe('resolveFileIconExtension', () => {
  // Regressão: o painel de documentos passava só o mimeType, e o do Office é longo
  // (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), então docx, doc,
  // xlsx e xls apareciam todos com o ícone genérico cinza.
  const OFFICE_MIME_TYPES = [
    {
      filename: 'contrato.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expected: 'docx',
    },
    { filename: 'procuracao.doc', mimeType: 'application/msword', expected: 'doc' },
    {
      filename: 'pedido.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      expected: 'xlsx',
    },
    { filename: 'tabela.xls', mimeType: 'application/vnd.ms-excel', expected: 'xls' },
  ]

  for (const testCase of OFFICE_MIME_TYPES) {
    it(`resolve ${testCase.expected} pelo nome, já que o mimeType do Office não bate`, () => {
      expect(resolveFileIconExtension(testCase.filename, testCase.mimeType)).toBe(testCase.expected)
    })
  }

  it('resolve pelo mimeType quando o nome não tem extensão conhecida', () => {
    expect(resolveFileIconExtension(undefined, 'application/pdf')).toBe('pdf')
    expect(resolveFileIconExtension('recibo', 'application/zip')).toBe('zip')
  })

  it('devolve algo fora do mapa para tipo desconhecido, caindo no ícone genérico', () => {
    expect(resolveFileIconExtension('backup', 'application/octet-stream')).toBe('octet-stream')
  })

  // Imagem, vídeo e áudio entram na biblioteca junto dos documentos — o backend linka as cinco
  // espécies de mídia (image/audio/video/document/sticker), não só `document`.
  const MEDIA_TYPES = [
    { filename: 'foto.jpg', mimeType: 'image/jpeg', expected: 'jpg' },
    { filename: 'prateleira.png', mimeType: 'image/png', expected: 'png' },
    { filename: 'video-do-produto.mp4', mimeType: 'video/mp4', expected: 'mp4' },
    { filename: 'antigo.3gp', mimeType: 'video/3gp', expected: '3gp' },
    { filename: 'musica.mp3', mimeType: 'audio/mpeg', expected: 'mp3' },
    { filename: 'recado.m4a', mimeType: 'audio/mp4', expected: 'm4a' },
    { filename: 'lista-compras.txt', mimeType: 'text/plain', expected: 'txt' },
    { filename: 'planilha.csv', mimeType: 'text/csv', expected: 'csv' },
    {
      filename: 'apresentacao.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      expected: 'pptx',
    },
  ]

  for (const testCase of MEDIA_TYPES) {
    it(`resolve ${testCase.expected}`, () => {
      expect(resolveFileIconExtension(testCase.filename, testCase.mimeType)).toBe(testCase.expected)
    })
  }

  // Áudio e sticker chegam da Meta sem nome de arquivo: o backend salva o id da mídia como rótulo,
  // então a única pista de tipo é o mimeType.
  it('resolve pela família quando o nome é o id da mídia, sem extensão', () => {
    expect(resolveFileIconExtension('wamid-abc123', 'image/webp')).toBe('image')
    expect(resolveFileIconExtension('wamid-abc123', 'video/mp4')).toBe('video')
    expect(resolveFileIconExtension('wamid-abc123', 'audio/aac')).toBe('audio')
  })

  // `audio/ogg; codecs=opus` é o formato do áudio de WhatsApp. Com o parâmetro colado, o subtipo
  // viria "ogg; codecs=opus" e o áudio cairia no ícone genérico.
  it('descarta parâmetro do mimeType', () => {
    expect(resolveFileIconExtension('wamid-audio', 'audio/ogg; codecs=opus')).toBe('audio')
  })

  // Pelo subtipo, `audio/mp4` casaria a chave `mp4` — que é vídeo. A família vem primeiro
  // justamente para um m4a não aparecer com ícone de filme.
  it('não confunde audio/mp4 com vídeo', () => {
    expect(resolveFileIconExtension(undefined, 'audio/mp4')).toBe('audio')
    expect(resolveFileIconExtension(undefined, 'video/mp4')).toBe('video')
  })
})
