import { describe, expect, it } from 'bun:test'

import { detectQuickReplyShortcut, replaceQuickReplyShortcut } from './quickReplyShortcut'

describe('detectQuickReplyShortcut', () => {
  it('acha o atalho no início do texto', () => {
    expect(detectQuickReplyShortcut('/doc')).toEqual({ start: 0, term: 'doc' })
  })

  it('acha o atalho depois de espaço', () => {
    expect(detectQuickReplyShortcut('Olá, /doc')).toEqual({ start: 5, term: 'doc' })
  })

  it('acha o atalho vazio (só a barra, ainda sem termo)', () => {
    expect(detectQuickReplyShortcut('/')).toEqual({ start: 0, term: '' })
  })

  it('apagar a barra some com o atalho', () => {
    expect(detectQuickReplyShortcut('Olá, doc')).toBeUndefined()
  })

  it('barra no meio da palavra não é atalho', () => {
    expect(detectQuickReplyShortcut('km/h')).toBeUndefined()
  })
})

describe('replaceQuickReplyShortcut', () => {
  it('troca o atalho pelo corpo resolvido e devolve onde o cursor cai', () => {
    const result = replaceQuickReplyShortcut({
      text: 'Olá, /doc',
      start: 5,
      caret: 9,
      replacement: 'Envie seu RG, Marina.',
    })
    expect(result.text).toBe('Olá, Envie seu RG, Marina.')
    expect(result.caret).toBe(5 + 'Envie seu RG, Marina.'.length)
  })
})
