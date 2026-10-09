import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { StatusTicks } from './StatusTicks'

const TAILWIND_UTILITIES = ['text-sky-500', 'text-red-500', 'text-black/40', 'flex', 'cursor-help', 'leading-none']

describe('StatusTicks', () => {
  it('em stylesheet renderiza o estado queued com relógio e rótulo acessível', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="queued" appearance="stylesheet" />)

    expect(markup).toContain('cv-status-ticks--queued')
    expect(markup).toContain('aria-label="Queued"')
  })

  it('em stylesheet o rótulo de queued é configurável', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="queued" appearance="stylesheet" queuedLabel="Na fila" />)

    expect(markup).toContain('aria-label="Na fila"')
  })

  it('em stylesheet trata bounced como failed', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="bounced" appearance="stylesheet" />)

    expect(markup).toContain('cv-status-ticks--failed')
    expect(markup).not.toContain('cv-status-ticks--bounced')
  })

  it('por padrão mantém as utilitárias Tailwind e nenhum aria-label (0.4.2)', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="read" />)

    expect(markup).toContain('text-sky-500')
    expect(markup).toContain('cursor-help')
    expect(markup).not.toContain('cv-status-ticks')
    expect(markup).not.toContain('aria-label')
  })

  it.each(['sent', 'delivered', 'read', 'failed', 'queued'])('em stylesheet usa só classes cv-* em %s', (status) => {
    const markup = renderToStaticMarkup(<StatusTicks status={status} appearance="stylesheet" />)

    expect(markup).toContain(`cv-status-ticks--${status}`)
    for (const utility of TAILWIND_UTILITIES) expect(markup).not.toContain(utility)
    expect(markup).not.toContain('text-[')
  })
})
