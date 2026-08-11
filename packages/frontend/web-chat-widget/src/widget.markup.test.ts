/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { describe, expect, it } from 'bun:test'

import { parseMarkup } from './widget.markup'

describe('parseMarkup', () => {
  it('transforma asterisco em negrito e sublinhado em italico', () => {
    expect(parseMarkup('Somos a *Ada* e fazemos _isso_.')).toEqual([
      { type: 'text', value: 'Somos a ' },
      { type: 'marked', tag: 'strong', children: [{ type: 'text', value: 'Ada' }] },
      { type: 'text', value: ' e fazemos ' },
      { type: 'marked', tag: 'em', children: [{ type: 'text', value: 'isso' }] },
      { type: 'text', value: '.' },
    ])
  })

  it('aninha marcacao', () => {
    expect(parseMarkup('*negrito _com italico_*')).toEqual([
      {
        type: 'marked',
        tag: 'strong',
        children: [
          { type: 'text', value: 'negrito ' },
          { type: 'marked', tag: 'em', children: [{ type: 'text', value: 'com italico' }] },
        ],
      },
    ])
  })

  // Marcador solto e conteudo, nao formatacao: quem escreve "2 * 3" nao pediu negrito, e o cliente
  // veria o resto da frase sumir dentro de um <strong> que nunca fecha.
  it('deixa marcador solto como texto', () => {
    expect(parseMarkup('2 * 3 e 6')).toEqual([{ type: 'text', value: '2 * 3 e 6' }])
    expect(parseMarkup('abre * mas nao fecha')).toEqual([{ type: 'text', value: 'abre * mas nao fecha' }])
  })

  it('nao interpreta marcador colado em espaco', () => {
    expect(parseMarkup('* nao vale *')).toEqual([{ type: 'text', value: '* nao vale *' }])
  })

  // O texto vem do editor de fluxo do painel: o parser nunca pode devolver algo que a montagem
  // trate como marcacao de HTML.
  it('trata tag html como texto puro', () => {
    expect(parseMarkup('<script>alert(1)</script>')).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }])
  })

  it('devolve lista vazia para texto vazio', () => {
    expect(parseMarkup('')).toEqual([])
  })
})
