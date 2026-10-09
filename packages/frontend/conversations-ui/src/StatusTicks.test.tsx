import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { StatusTicks } from './StatusTicks'

const TAILWIND_UTILITIES = ['text-sky-500', 'text-red-500', 'text-black/40', 'flex', 'cursor-help', 'leading-none']

describe('StatusTicks', () => {
  it('renderiza o estado queued com relógio e rótulo acessível', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="queued" />)

    expect(markup).toContain('cv-status-ticks--queued')
    expect(markup).toContain('aria-label="Queued"')
  })

  it('trata bounced como failed', () => {
    const markup = renderToStaticMarkup(<StatusTicks status="bounced" />)

    expect(markup).toContain('cv-status-ticks--failed')
    expect(markup).not.toContain('cv-status-ticks--bounced')
  })

  it.each(['sent', 'delivered', 'read', 'failed', 'queued'])('usa só classes cv-* em %s', (status) => {
    const markup = renderToStaticMarkup(<StatusTicks status={status} />)

    expect(markup).toContain(`cv-status-ticks--${status}`)
    for (const utility of TAILWIND_UTILITIES) expect(markup).not.toContain(utility)
    expect(markup).not.toContain('text-[')
  })
})
