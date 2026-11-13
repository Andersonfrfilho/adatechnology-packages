/**
 * Goldens of the participant thread (264, contract.md §2.4, §3): the empty composer must not change, and the
 * audio player and transcription blocks are pinned byte for byte. The composer goldens live in
 * `participantComposerAudioGolden.test.tsx`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantConversations } from './ParticipantConversations'
import { ParticipantThread } from './ParticipantThread'
import {
  buildThreadProps,
  renderGoldenScenarios,
  type GoldenComponents,
} from './participantGoldenScenarios.test-helper'
import { buildMessage } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeRecording } from './participantRecorderFakes.test-helper'

const FIXTURES_DIRECTORY = join(import.meta.dir, 'test-fixtures')
const PRE_EXISTING_GOLDENS = [
  'thread-default',
  'thread-plain',
  'thread-avatars-initials',
  'thread-tail-off',
  'thread-error',
  'thread-loading',
  'thread-closed',
  'conversations-list',
  'conversations-selected',
]

function readGolden(name: string): string {
  return readFileSync(join(FIXTURES_DIRECTORY, `${name}.golden.html`), 'utf8')
}

const UntypedThread = ParticipantThread as unknown as ComponentType<Record<string, unknown>>

function renderThread(extra: Record<string, unknown>): string {
  const props = { ...buildThreadProps(DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS), ...extra }
  return renderToStaticMarkup(<UntypedThread {...props} />)
}

describe('empty composer stays byte-identical to origin/main a7c5c85 (contract 2.4)', () => {
  let restoreEnvironment: (() => void) | undefined

  beforeAll(() => {
    process.env.TZ = 'UTC'
  })

  afterEach(() => {
    restoreEnvironment?.()
    restoreEnvironment = undefined
  })

  it('(a) without the audioRecording prop', () => {
    expect(renderThread({ draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined } })).toBe(
      readGolden('thread-empty-draft'),
    )
  })

  it('(b) with audioRecording={{}} on the server render (no MediaRecorder)', () => {
    const markup = renderThread({
      draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined },
      audioRecording: {},
    })
    expect(markup).toBe(readGolden('thread-empty-draft'))
  })

  it('(c) with audioRecording={{}}, a fake MediaRecorder and channel portal (portal never records)', () => {
    restoreEnvironment = installFakeRecording().restore
    const markup = renderThread({
      draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined },
      audioRecording: {},
      channel: 'portal',
    })
    expect(markup).toBe(readGolden('thread-empty-draft'))
  })
})

describe('the existing goldens carry no audio; the audio goldens document the player that replaced the native one', () => {
  it('none of the 9 recorded goldens has an <audio> element', () => {
    expect(PRE_EXISTING_GOLDENS).toHaveLength(9)
    for (const name of PRE_EXISTING_GOLDENS) expect(readGolden(name).match(/<audio/g)?.length ?? 0).toBe(0)
  })

  it('thread-audio-native was regrouped by 264 T1.5: same attachment without durationMs, now the player (no native controls)', () => {
    const markup = readGolden('thread-audio-native')
    expect(markup.match(/<audio/g)).toHaveLength(1)
    expect(markup).not.toContain('controls')
    expect(markup).not.toContain('cv-p-attachment__audio')
    expect(markup).toContain('0:00 / --:--')
  })

  it('the helper renders the new scenarios and the 9 existing ones', () => {
    const rendered = renderGoldenScenarios({
      ParticipantThread,
      ParticipantConversations,
      labels: DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS,
    } as unknown as GoldenComponents)
    for (const name of [...PRE_EXISTING_GOLDENS, 'thread-empty-draft', 'thread-audio-native', 'thread-audio-player'])
      expect(rendered[name]).toBe(readGolden(name))
  })
})

function renderThreadGoldens(): Record<string, string> {
  return renderGoldenScenarios({
    ParticipantThread,
    ParticipantConversations,
    labels: DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS,
  } as unknown as GoldenComponents)
}

const AUDIO_ATTACHMENT = { id: 'att-1', kind: 'audio', filename: 'voice.webm', mimeType: 'audio/webm', sizeBytes: 2048, durationMs: 65_000 }
const GENERATED_AT = '2026-10-01T12:01:00.000Z'

function audioItems(transcription?: Record<string, unknown>): Record<string, unknown>[] {
  const attachments = [{ ...AUDIO_ATTACHMENT, ...(transcription === undefined ? {} : { transcription }) }]
  return [{ kind: 'server', message: buildMessage({ id: 'au', direction: 'inbound', text: '', attachments: attachments as never, createdAt: '2026-10-01T12:00:00.000Z' }) }]
}

describe('[T1.5] thread-audio-player: the custom player replaces <audio controls> (contract 3.1-3.2)', () => {
  it('thread-audio-player is byte-identical to its golden', () => {
    expect(renderThread({ items: audioItems() })).toBe(readGolden('thread-audio-player'))
  })

  it('renders the contract 3.1 markup: group, toggle, range, time, rate and a preload="none" audio after which comes the file name', () => {
    const markup = readGolden('thread-audio-player')
    expect(markup).toContain('<div class="cv-p-audio" role="group" aria-label="Audio: voice.webm">')
    expect(markup).toContain('type="range" class="cv-p-audio__seek"')
    expect(markup).toContain('0:00 / 1:05')
    expect(markup).toContain('<audio class="cv-p-audio__media" preload="none"></audio>')
    expect(markup.indexOf('cv-p-audio__media')).toBeLessThan(markup.indexOf('cv-p-attachment__name'))
  })

  it('no other recorded golden changes: the 9 old ones and the empty draft stay without the player', () => {
    for (const name of [...PRE_EXISTING_GOLDENS, 'thread-empty-draft']) expect(readGolden(name)).not.toContain('cv-p-audio')
    expect(Object.keys(renderThreadGoldens()).sort()).toEqual(
      [...PRE_EXISTING_GOLDENS, 'thread-empty-draft', 'thread-audio-native', 'thread-audio-player'].sort(),
    )
  })
})

describe('[T1.6] thread-audio-transcription-*: the block under the player (contract 3.3)', () => {
  const scenarios: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['pending', { status: 'pending' }],
    ['ready', { status: 'ready', text: 'Chego em dez minutos.', language: 'pt', engine: 'whisper-local', generatedAt: GENERATED_AT }],
    ['empty', { status: 'ready', text: '', generatedAt: GENERATED_AT }],
    ['too_long', { status: 'failed', reason: 'too_long', maxDurationMs: 300_000 }],
  ]

  for (const [state, transcription] of scenarios) {
    it(`thread-audio-transcription-${state} is byte-identical to its golden`, () => {
      expect(renderThread({ items: audioItems(transcription) })).toBe(readGolden(`thread-audio-transcription-${state}`))
    })
  }

  it('absent, disabled and plain failed transcriptions render only the player', () => {
    const playerOnly = renderThread({ items: audioItems() })
    for (const transcription of [{ status: 'disabled' }, { status: 'failed' }]) {
      expect(renderThread({ items: audioItems(transcription) })).toBe(playerOnly)
    }
  })
})
