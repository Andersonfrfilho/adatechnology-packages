import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ActiveSwitch } from './ActiveSwitch'

const noop = () => undefined

describe('ActiveSwitch', () => {
  it('é um switch nomeado, operável pelo teclado (checkbox nativo)', () => {
    const markup = renderToStaticMarkup(<ActiveSwitch checked label="Produto ativo" onChange={noop} />)

    expect(markup).toContain('type="checkbox"')
    expect(markup).toContain('role="switch"')
    expect(markup).toContain('aria-label="Produto ativo"')
    expect(markup).toContain('checked=""')
    expect(markup).not.toContain('tabindex="-1"')
  })

  it('desligado não marca checked', () => {
    const markup = renderToStaticMarkup(<ActiveSwitch checked={false} label="Produto ativo" onChange={noop} />)

    expect(markup).not.toContain('checked=""')
  })

  it('anima a cor da trilha e o transform do thumb em 150 ms, sem animar layout', () => {
    const markup = renderToStaticMarkup(<ActiveSwitch checked label="x" onChange={noop} />)

    expect(markup).toContain('transition-colors')
    expect(markup).toContain('duration-150')
    expect(markup).toContain('after:transition-[transform,border-color]')
    expect(markup).toContain('after:duration-150')
    expect(markup).not.toContain('transition-all')
  })

  it('mostra foco visível e zera a transição com movimento reduzido', () => {
    const markup = renderToStaticMarkup(<ActiveSwitch checked label="x" onChange={noop} />)

    expect(markup).toContain('peer-focus-visible:ring-2')
    expect(markup).toContain('motion-reduce:transition-none')
    expect(markup).toContain('motion-reduce:after:transition-none')
  })
})
