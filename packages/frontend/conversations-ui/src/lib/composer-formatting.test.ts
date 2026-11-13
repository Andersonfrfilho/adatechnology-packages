import { describe, expect, it } from 'bun:test'

import {
  FORMATTING_ACTION,
  FORMATTING_SEPARATOR,
  activeFormattingIn,
  canExecuteFormattingCommand,
  isFormattingActive,
  toggleFormattingCommand,
} from './composer-formatting'
import { ZERO_WIDTH_SPACE, htmlToWA, waToHTML } from './whatsapp-formatting'

describe('isFormattingActive', () => {
  it('reconhece cada formatação dentro do conjunto ativo', () => {
    const active = [FORMATTING_ACTION.BOLD, FORMATTING_ACTION.MONOSPACE].join(FORMATTING_SEPARATOR)

    expect(isFormattingActive({ active, action: FORMATTING_ACTION.BOLD })).toBe(true)
    expect(isFormattingActive({ active, action: FORMATTING_ACTION.MONOSPACE })).toBe(true)
    expect(isFormattingActive({ active, action: FORMATTING_ACTION.ITALIC })).toBe(false)
  })

  it('não acende nada quando o conjunto está vazio', () => {
    expect(isFormattingActive({ active: '', action: FORMATTING_ACTION.BOLD })).toBe(false)
  })
})

describe('activeFormattingIn', () => {
  it('não acende nada quando não há seleção no documento', () => {
    const editor = { contains: () => false } as unknown as HTMLElement

    expect(activeFormattingIn(editor)).toBe('')
  })
})

describe('toggleFormattingCommand', () => {
  it('avisa que não executou onde o comando não existe, para o campo cair no wrap manual', () => {
    if (canExecuteFormattingCommand()) return
    expect(toggleFormattingCommand(FORMATTING_ACTION.BOLD)).toBe(false)
  })

  it('não tem comando nativo para monoespaçado', () => {
    expect(toggleFormattingCommand(FORMATTING_ACTION.MONOSPACE)).toBe(false)
  })
})

describe('waToHTML dentro do campo editável', () => {
  it('escreve o tachado como <s>, que é o que o navegador consegue desfazer', () => {
    expect(waToHTML('~riscado~')).toBe('<s>riscado</s>')
  })

  it('mantém o ida e volta do tachado', () => {
    expect(htmlToWA(waToHTML('~riscado~'))).toBe('~riscado~')
  })
})

describe('htmlToWA e a âncora do cursor', () => {
  it('descarta o código que só tem a âncora, para não sair um par de crases vazio', () => {
    expect(htmlToWA(`oi <code>${ZERO_WIDTH_SPACE}</code>`)).toBe('oi')
  })

  it('tira a âncora de dentro do código que o operador chegou a preencher', () => {
    expect(htmlToWA(`<code>${ZERO_WIDTH_SPACE}npm run dev</code>`)).toBe('`npm run dev`')
  })

  it('não deixa a âncora vazar para o texto enviado', () => {
    expect(htmlToWA(`oi${ZERO_WIDTH_SPACE} tudo bem`)).toBe('oi tudo bem')
  })
})

describe('htmlToWA com a marcação do navegador', () => {
  it('converte o <strike> do execCommand para o tachado do WhatsApp', () => {
    expect(htmlToWA('<strike>cancelado</strike>')).toBe('~cancelado~')
  })

  it('converte o <b> e o <i> do navegador junto com as nossas tags', () => {
    expect(htmlToWA('<b>oi</b> <i>tudo</i> <strong>bem</strong>')).toBe('*oi* _tudo_ *bem*')
  })
})
