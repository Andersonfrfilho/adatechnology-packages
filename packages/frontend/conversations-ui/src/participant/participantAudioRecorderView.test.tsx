import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'bun:test'

import { ParticipantAudioRecorderView, type ParticipantAudioRecorderViewProps } from './ParticipantAudioRecorderView'
import type { RecorderStatus } from './participantAudioRecorderState'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

function render(overrides: Partial<ParticipantAudioRecorderViewProps> & { state: RecorderStatus }): string {
  return renderToStaticMarkup(<ParticipantAudioRecorderView elapsedMs={12_000} {...overrides} />)
}

describe('idle and requesting', () => {
  it('renders the microphone as a non-submitting primary button named by recordAudio', () => {
    const markup = render({ state: 'idle' })
    expect(markup).toContain('type="button"')
    expect(markup).toContain('class="cv-p-button cv-p-button--primary cv-p-composer__record"')
    expect(markup).toContain('aria-label="Record audio"')
    expect(markup).not.toContain('type="submit"')
    expect(markup).not.toContain('aria-busy')
  })

  it('is busy and disabled while the permission is pending', () => {
    const markup = render({ state: 'requesting' })
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('disabled=""')
  })

  it('is disabled when the composer is', () => {
    expect(render({ state: 'idle', disabled: true })).toContain('disabled=""')
  })
})

describe('recording', () => {
  it('shows the clock "m:ss of m:ss", discard and stop, and no aria-live', () => {
    const markup = render({ state: 'recording' })
    expect(markup).toContain('role="group"')
    expect(markup).toContain('aria-label="Recording"')
    expect(markup).toContain('role="timer"')
    expect(markup).toContain('0:12 of 5:00')
    expect(markup).toContain('cv-p-recorder__discard')
    expect(markup).toContain('cv-p-recorder__stop')
    expect(markup).not.toContain('aria-live')
    expect(markup).not.toContain('cv-p-composer__record')
  })

  it('uses the lowered ceiling in the clock', () => {
    expect(render({ state: 'recording', maxDurationMs: 90_000 })).toContain('0:12 of 1:30')
  })

  it('every button is type="button"', () => {
    const buttons = render({ state: 'recording' }).match(/<button[^>]*>/g) ?? []
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button).toContain('type="button"')
  })
})

describe('review', () => {
  it('has the hint, the player over the object URL, discard and send', () => {
    const markup = render({ state: 'review', review: { url: 'blob:abc' } })
    expect(markup).toContain('cv-p-recorder--review')
    expect(markup).toContain('<p class="cv-p-recorder__hint" aria-hidden="true">Listen before sending</p>')
    expect(markup).toContain('<audio')
    expect(markup).toContain('src="blob:abc"')
    expect(markup).toContain('cv-p-recorder__discard')
    expect(markup).toContain('cv-p-recorder__send')
    expect(markup).toContain('aria-label="Send audio"')
  })
})

describe('failure states', () => {
  const cases: ReadonlyArray<readonly [RecorderStatus, string]> = [
    ['denied', 'No permission to use the microphone.'],
    ['unsupported', 'This device cannot record audio.'],
    ['empty', 'Nothing was captured by the microphone.'],
    ['tooLarge', 'Audio too large to send.'],
  ]
  for (const [state, text] of cases) {
    it(`${state} keeps the microphone and announces the phrase as an alert`, () => {
      const markup = render({ state })
      expect(markup).toContain(`<p class="cv-p-composer__error" role="alert">${text}</p>`)
      expect(markup).toContain('cv-p-composer__record')
    })
  }
})

describe('labels', () => {
  it('uses the English defaults when the host map does not carry the new keys', () => {
    const { recordAudio: _omitted, ...withoutAudio } = DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS
    expect(render({ state: 'idle', labels: withoutAudio })).toContain('aria-label="Record audio"')
  })

  it('takes the host translation when present', () => {
    const labels = { ...DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS, recordAudio: 'Gravar áudio', recordingElapsed: '{elapsed} de {limit}' }
    expect(render({ state: 'idle', labels })).toContain('aria-label="Gravar áudio"')
    expect(render({ state: 'recording', labels })).toContain('0:12 de 5:00')
  })
})
