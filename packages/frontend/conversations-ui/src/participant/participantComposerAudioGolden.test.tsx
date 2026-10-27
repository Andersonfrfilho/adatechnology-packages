import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantAudioRecorderView } from './ParticipantAudioRecorderView'
import { ParticipantThread } from './ParticipantThread'
import { buildThreadProps } from './participantGoldenScenarios.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeRecording } from './participantRecorderFakes.test-helper'

function readGolden(name: string): string {
  return readFileSync(join(import.meta.dir, 'test-fixtures', `${name}.golden.html`), 'utf8')
}

const Thread = ParticipantThread as unknown as ComponentType<Record<string, unknown>>

function renderThreadWithMicrophone(): string {
  const props = {
    ...buildThreadProps(DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS),
    draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined },
    audioRecording: {},
    onSendAudio: () => undefined,
  }
  return renderToStaticMarkup(<Thread {...props} />)
}

describe('the real composer with the microphone (contract 2.2), not only the pure view', () => {
  let restore: (() => void) | undefined

  beforeAll(() => {
    process.env.TZ = 'UTC'
  })

  afterEach(() => restore?.())

  it('thread-composer-microphone-idle is byte-identical to its golden', () => {
    restore = installFakeRecording().restore
    const markup = renderThreadWithMicrophone()
    expect(markup).toBe(readGolden('thread-composer-microphone-idle'))
  })
})

describe('composer-audio-*: the pure recorder view (contract 2.2-2.3)', () => {
  for (const state of ['idle', 'recording', 'review', 'denied'] as const) {
    it(`composer-audio-${state} is byte-identical to its golden`, () => {
      const markup = renderToStaticMarkup(
        <ParticipantAudioRecorderView state={state} elapsedMs={12_000} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />,
      )
      expect(markup).toBe(readGolden(`composer-audio-${state}`))
    })
  }
})

describe('the microphone in the composer (contract 2.2)', () => {
  let restore: (() => void) | undefined

  afterEach(() => restore?.())

  it('takes the place of send only with the prop, an empty field and a recording browser', () => {
    restore = installFakeRecording().restore
    const withProp = renderThreadWithMicrophone()
    expect(withProp).toContain('cv-p-composer__record')
    expect(withProp).not.toContain('cv-p-composer__send')
  })
})
