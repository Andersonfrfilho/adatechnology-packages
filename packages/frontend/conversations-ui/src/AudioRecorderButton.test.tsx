import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AudioRecorderButton, DEFAULT_AUDIO_RECORDER_BUTTON_LABELS } from './AudioRecorderButton'

const noop = () => {}

describe('AudioRecorderButton', () => {
  it('começa oferecendo gravar, sem painel de revisão à vista', () => {
    const markup = renderToStaticMarkup(<AudioRecorderButton onRecorded={noop} />)

    expect(markup).toContain(`title="${DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.start}"`)
    expect(markup).not.toContain(`title="${DEFAULT_AUDIO_RECORDER_BUTTON_LABELS.send}"`)
    expect(markup).not.toContain('<audio')
  })

  it('deixa o host trocar o texto de um rótulo sem perder os outros', () => {
    const markup = renderToStaticMarkup(
      <AudioRecorderButton onRecorded={noop} labels={{ start: 'Gravar recado' }} />,
    )

    expect(markup).toContain('title="Gravar recado"')
  })

  it('mantém a caixa de 40px do botão de enviar para a barra não pular', () => {
    const markup = renderToStaticMarkup(<AudioRecorderButton onRecorded={noop} />)

    expect(markup).toContain('h-10 w-10')
  })
})
