import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { RetryButton } from './ParticipantBubbleStatus'
import { ParticipantConversations } from './ParticipantConversations'
import { ParticipantFailedMenu } from './ParticipantFailedMenu'
import { ParticipantLinkCopyButton } from './ParticipantCopyableToken'
import { ParticipantScrollToLatest } from './ParticipantScrollToLatest'
import { ParticipantThread } from './ParticipantThread'
import { renderGoldenScenarios, type GoldenComponents } from './participantGoldenScenarios.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'

const noop = (): void => undefined

function visibleText(buttonInner: string): string {
  return buttonInner
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<span[^>]*cv-p-sr-only[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** Buttons that neither show text nor carry a tooltip: the ones a sighted mouse user cannot name. */
function untooltippedIconButtons(markup: string): string[] {
  const found: string[] = []
  for (const match of markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attributes = match[1] ?? ''
    if (attributes.includes('data-cv-tooltip=')) continue
    if (visibleText(match[2] ?? '') === '') found.push(attributes.trim())
  }
  return found
}

describe('participant tooltips', () => {
  const scenarios = renderGoldenScenarios({
    ParticipantThread,
    ParticipantConversations,
    labels: LABELS,
  } as unknown as GoldenComponents)

  it('every icon-only button of the rendered scenarios has a tooltip', () => {
    for (const [name, markup] of Object.entries(scenarios)) {
      expect({ name, buttons: untooltippedIconButtons(markup) }).toEqual({ name, buttons: [] })
    }
  })

  it('marks the controls the scenarios do not show at rest', () => {
    const markups = [
      renderToStaticMarkup(<RetryButton labels={LABELS} onRetry={noop} />),
      renderToStaticMarkup(<ParticipantFailedMenu labels={LABELS} onEdit={noop} />),
      renderToStaticMarkup(<ParticipantLinkCopyButton value="https://a.test" labels={LABELS} />),
      renderToStaticMarkup(
        <ParticipantScrollToLatest label="Latest" isAwayFromBottom hasMessages newMessagesCount={0} onClick={noop} />,
      ),
    ]
    for (const markup of markups) {
      expect(markup).toContain('<button')
      expect(untooltippedIconButtons(markup)).toEqual([])
    }
  })

  it('the retry tooltip is the long failure text, the same as its accessible name', () => {
    const markup = renderToStaticMarkup(<RetryButton labels={LABELS} onRetry={noop} />)
    expect(markup).toContain('data-cv-tooltip="Failed — tap to retry"')
  })

  it('renders no tooltip balloon at rest and never a native title', () => {
    for (const markup of Object.values(scenarios)) {
      expect(markup).not.toContain('class="cv-tooltip')
      expect(markup).not.toMatch(/ title="/)
    }
  })
})
