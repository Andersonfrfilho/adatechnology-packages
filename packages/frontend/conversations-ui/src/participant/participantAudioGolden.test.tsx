/**
 * Suíte "vermelha da Fase 1" da spec 264 (contract.md §2.4, §3, §4): congela o que NÃO pode mudar e
 * deixa escritos os cenários de áudio que as tasks T1.3 a T1.6 ligam. Nada aqui falha no CI:
 * o que depende de componente ou prop ainda inexistente está em `describe.skip`, cada um com a task
 * que o religa (troque `describe.skip` por `describe` ao implementá-la e grave o ouro novo).
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

function installFakeRecordingEnvironment(): () => void {
  const globals = globalThis as Record<string, unknown>
  const previousRecorder = globals.MediaRecorder
  const navigatorObject = globalThis.navigator as unknown as Record<string, unknown>
  const previousMediaDevices = navigatorObject.mediaDevices
  globals.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported(): boolean {
      return true
    }
  }
  navigatorObject.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [] }) }
  return () => {
    globals.MediaRecorder = previousRecorder
    navigatorObject.mediaDevices = previousMediaDevices
  }
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
    restoreEnvironment = installFakeRecordingEnvironment()
    const markup = renderThread({
      draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined },
      audioRecording: {},
      channel: 'portal',
    })
    expect(markup).toBe(readGolden('thread-empty-draft'))
  })
})

describe('the existing goldens carry no audio and the native player is covered', () => {
  it('none of the 9 recorded goldens has an <audio> element', () => {
    expect(PRE_EXISTING_GOLDENS).toHaveLength(9)
    for (const name of PRE_EXISTING_GOLDENS) expect(readGolden(name).match(/<audio/g)?.length ?? 0).toBe(0)
  })

  it('thread-audio-native freezes exactly one native <audio controls> from the current code', () => {
    const markup = readGolden('thread-audio-native')
    expect(markup.match(/<audio/g)).toHaveLength(1)
    expect(markup).toContain('class="cv-p-attachment__audio" controls=""')
  })

  it('the helper renders both new scenarios and the 9 existing ones', () => {
    const rendered = renderGoldenScenarios({
      ParticipantThread,
      ParticipantConversations,
      labels: DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS,
    } as unknown as GoldenComponents)
    for (const name of [...PRE_EXISTING_GOLDENS, 'thread-empty-draft', 'thread-audio-native'])
      expect(rendered[name]).toBe(readGolden(name))
  })
})

const AUDIO_ATTACHMENT = { id: 'att-1', kind: 'audio', filename: 'voice.webm', mimeType: 'audio/webm', sizeBytes: 2048, durationMs: 65_000 }
const GENERATED_AT = '2026-10-01T12:01:00.000Z'

function audioItems(transcription?: Record<string, unknown>): Record<string, unknown>[] {
  const attachments = [{ ...AUDIO_ATTACHMENT, ...(transcription === undefined ? {} : { transcription }) }]
  return [{ kind: 'server', message: buildMessage({ id: 'au', direction: 'inbound', text: '', attachments: attachments as never, createdAt: '2026-10-01T12:00:00.000Z' }) }]
}

/** Dynamic path on purpose: the module does not exist until the task that re-enables the suite. */
async function loadModule(name: string): Promise<Record<string, unknown>> {
  return (await import(`./${name}`)) as Record<string, unknown>
}

describe.skip('[T1.5] thread-audio-player: the custom player replaces <audio controls> (contract 3.1-3.2)', () => {
  it('thread-audio-player is byte-identical to its golden', () => {
    expect(renderThread({ items: audioItems() })).toBe(readGolden('thread-audio-player'))
  })

  it('no other recorded golden changes', () => {
    for (const name of PRE_EXISTING_GOLDENS) expect(readGolden(name)).not.toContain('cv-p-audio')
  })
})

describe.skip('[T1.6] thread-audio-transcription-*: the block under the player (contract 3.3)', () => {
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

describe('[T1.3] composer-audio-*: the pure recorder view (contract 2.2-2.3)', () => {
  const states = ['idle', 'recording', 'review', 'denied'] as const

  for (const state of states) {
    it(`composer-audio-${state} is byte-identical to its golden`, async () => {
      const module = await loadModule('ParticipantAudioRecorderView')
      const View = module.ParticipantAudioRecorderView as (props: Record<string, unknown>) => React.ReactElement
      const markup = renderToStaticMarkup(
        <View state={state} elapsedMs={12_000} labels={DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS} />,
      )
      expect(markup).toBe(readGolden(`composer-audio-${state}`))
    })
  }

})

describe('[T1.4] the microphone in the composer (contract 2.2)', () => {
  it('the microphone takes the place of send only with the prop, an empty field and a recording browser', () => {
    const restore = installFakeRecordingEnvironment()
    try {
      const withProp = renderThread({
        draft: { value: '', onChange: () => undefined, files: [], onFilesChange: () => undefined },
        audioRecording: {},
        onSendAudio: () => undefined,
      })
      expect(withProp).toContain('cv-p-composer__record')
      expect(withProp).not.toContain('cv-p-composer__send')
    } finally {
      restore()
    }
  })
})
