import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { splitBlocks } from '../cssBlocks.test-helper'
import { buildMessage, findForeignClassTokens, findUtilityClassTokens } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { ParticipantMessageBubble, type ParticipantMessageBubbleProps } from './ParticipantMessageBubble'

const CSS = readFileSync(join(import.meta.dir, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function declarationsOf(selector: string): Map<string, string> {
  const declarations = new Map<string, string>()
  for (const { prelude, body } of splitBlocks(CSS)) {
    if (body === undefined || prelude.startsWith('@')) continue
    if (!prelude.split(',').some((entry) => entry.trim() === selector)) continue
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator === -1) continue
      declarations.set(declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim())
    }
  }
  return declarations
}

function render(direction: 'inbound' | 'outbound', extra: Partial<ParticipantMessageBubbleProps> = {}): string {
  return renderToStaticMarkup(
    <ParticipantMessageBubble
      item={{ kind: 'server', message: buildMessage({ id: 'm1', direction }) }}
      labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS}
      confirmsRead
      resolveAttachmentUrl={async () => 'https://files.example/a.png'}
      {...extra}
    />,
  )
}

describe('bubble tail CSS', () => {
  it('draws two decorative triangles that never catch touches', () => {
    for (const pseudo of ['::before', '::after']) {
      const tail = declarationsOf(`.cv-p-bubble${pseudo}`)
      expect(tail.get('content')).toBe("''")
      expect(tail.get('pointer-events')).toBe('none')
      expect(tail.get('position')).toBe('absolute')
      expect(tail.get('border-style')).toBe('solid')
    }
    expect(declarationsOf('.cv-p-bubble').get('position')).toBe('relative')
  })

  it('puts the received tail on the left, edge colour under fill colour', () => {
    expect(declarationsOf('.cv-p-bubble::before').get('left')).toBe('-10px')
    expect(declarationsOf('.cv-p-bubble::after').get('left')).toBe('-8px')
    expect(declarationsOf('.cv-p-bubble::before').get('border-bottom-color')).toBe('var(--cv-p-tail-edge)')
    expect(declarationsOf('.cv-p-bubble::after').get('border-bottom-color')).toBe('var(--cv-p-tail-fill)')
    expect(declarationsOf('.cv-p-bubble').get('border-bottom-left-radius')).toBe('0')
  })

  it('mirrors the own tail to the right with the own tokens', () => {
    expect(declarationsOf('.cv-p-bubble--mine::before').get('right')).toBe('-10px')
    expect(declarationsOf('.cv-p-bubble--mine::after').get('right')).toBe('-8px')
    const mine = declarationsOf('.cv-p-bubble--mine')
    expect(mine.get('border-bottom-right-radius')).toBe('0')
    expect(mine.get('--cv-p-tail-edge')).toBe('var(--cv-p-i-accent)')
    expect(mine.get('--cv-p-tail-fill')).toBe('var(--cv-p-i-highlight)')
    expect(declarationsOf('.cv-p-bubble').get('--cv-p-tail-edge')).toBe('var(--cv-p-i-border)')
    expect(declarationsOf('.cv-p-bubble').get('--cv-p-tail-fill')).toBe('var(--cv-p-i-surface-raised)')
  })

  it('turns the tail off and restores the corner with --no-tail', () => {
    expect(declarationsOf('.cv-p-bubble--no-tail::before').get('content')).toBe('none')
    expect(declarationsOf('.cv-p-bubble--no-tail::after').get('content')).toBe('none')
    expect(declarationsOf('.cv-p-bubble--no-tail').get('border-radius')).toBe('var(--cv-p-i-radius)')
  })

  it('uses no fixed colour for the tail', () => {
    const tailRules = splitBlocks(CSS).filter(({ prelude }) => /cv-p-bubble[^,{]*::(before|after)/.test(prelude))
    expect(tailRules.length).toBeGreaterThan(0)
    for (const { body } of tailRules) expect(body ?? '').not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i)
  })
})

describe('bubble tail markup', () => {
  it('keeps the default markup free of any new class', () => {
    expect(render('outbound')).toContain('<div class="cv-p-bubble">')
    expect(render('inbound')).toContain('<div class="cv-p-bubble cv-p-bubble--mine">')
  })

  it('adds --no-tail only when tail is false, on both sides', () => {
    expect(render('outbound', { tail: false })).toContain('class="cv-p-bubble cv-p-bubble--no-tail"')
    expect(render('inbound', { tail: false })).toContain('class="cv-p-bubble cv-p-bubble--mine cv-p-bubble--no-tail"')
    expect(render('outbound', { tail: true })).not.toContain('--no-tail')
  })

  it('keeps the content and the avatar row unchanged by the tail flag', () => {
    const withAvatar = render('outbound', { avatar: <b>A</b>, tail: false })
    expect(withAvatar).toContain('cv-p-bubble-row')
    expect(withAvatar).toContain('cv-p-bubble--no-tail')
    expect(render('outbound', { tail: false })).toContain('cv-p-bubble__meta')
  })

  it('stays inside the participant namespace', () => {
    const markup = render('outbound', { tail: false })
    expect(findForeignClassTokens(markup)).toEqual([])
    expect(findUtilityClassTokens(markup)).toEqual([])
  })
})
