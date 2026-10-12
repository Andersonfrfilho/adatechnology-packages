import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantThread } from './ParticipantThread'
import { buildThreadProps } from './participantGoldenScenarios.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeRecording } from './participantRecorderFakes.test-helper'

const GOLDEN_PATH = join(import.meta.dir, 'test-fixtures', 'thread-composer-microphone-idle.golden.html')
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
    expect(markup).toBe(readFileSync(GOLDEN_PATH, 'utf8'))
  })
})
