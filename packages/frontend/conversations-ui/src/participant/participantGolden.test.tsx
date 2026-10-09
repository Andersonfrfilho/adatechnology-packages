import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeAll, describe, expect, it } from 'bun:test'

import { ParticipantConversations } from './ParticipantConversations'
import { ParticipantThread } from './ParticipantThread'
import { renderGoldenScenarios, type GoldenComponents } from './participantGoldenScenarios.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'

const FIXTURES_DIRECTORY = join(import.meta.dir, 'test-fixtures')

function readGolden(name: string): string {
  return readFileSync(join(FIXTURES_DIRECTORY, `${name}.golden.html`), 'utf8')
}

describe('participant default markup against the recorded origin/main output', () => {
  let rendered: Record<string, string> = {}

  beforeAll(() => {
    process.env.TZ = 'UTC'
    rendered = renderGoldenScenarios({
      ParticipantThread,
      ParticipantConversations,
      labels: DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS,
    } as unknown as GoldenComponents)
  })

  const scenarioNames = [
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

  for (const name of scenarioNames) {
    it(`${name} is byte-identical`, () => {
      expect(rendered[name]).toBe(readGolden(name))
    })
  }
})
