import { describe, expect, it } from 'bun:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantAuthorAvatar } from './ParticipantAuthorAvatar'

function render(hostResult: unknown): string {
  return renderToStaticMarkup(<ParticipantAuthorAvatar name="Ana Souza" render={() => hostResult as ReactNode} />)
}

describe('ParticipantAuthorAvatar host slot', () => {
  it('uses the host content when it returns something', () => {
    const markup = render(<img src="https://files.example/ana.png" alt="" />)
    expect(markup).toContain('ana.png')
    expect(markup).not.toContain('>AS<')
  })

  it.each([
    ['false', false],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the initials when the host returns %s', (_label, hostResult) => {
    expect(render(hostResult)).toContain('>AS<')
  })

  it('keeps zero as host content', () => {
    expect(render(0)).toContain('>0<')
  })
})
