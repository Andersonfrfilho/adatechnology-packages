import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { MessageComposer } from './MessageComposer'

describe('MessageComposer', () => {
  it('mostra a ação ociosa no lugar do enviar quando não há nada para enviar', () => {
    const markup = renderToStaticMarkup(
      <MessageComposer onSend={() => {}} idleAction={<button aria-label="Gravar áudio" />} />,
    )

    expect(markup).toContain('aria-label="Gravar áudio"')
    expect(markup).not.toContain('aria-label="Enviar"')
  })

  it('mantém o botão de enviar quando não há ação ociosa', () => {
    const markup = renderToStaticMarkup(<MessageComposer onSend={() => {}} />)

    expect(markup).toContain('aria-label="Enviar"')
  })

  it('mostra o enviar assim que há texto, mesmo com ação ociosa configurada', () => {
    const markup = renderToStaticMarkup(
      <MessageComposer
        onSend={() => {}}
        value="oi"
        onChange={() => {}}
        idleAction={<button aria-label="Gravar áudio" />}
      />,
    )

    expect(markup).toContain('aria-label="Enviar"')
    expect(markup).not.toContain('aria-label="Gravar áudio"')
  })
})
