/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { WHATSAPP_CHOICE_LIMIT } from '@adatechnology/meta-whatsapp-contracts'
import { buildFlowChoiceMessage } from './buildFlowChoiceMessage'

describe('buildFlowChoiceMessage — numbered text fallback', () => {
  it('stays within the text message limit and marks the cut', () => {
    const options = Array.from({ length: 12 }, (_, index) => ({
      id: `option-${index}`,
      title: `Opção ${index} com um título comprido demais para caber numa linha de lista`,
      description: 'x'.repeat(400),
    }))
    const message = buildFlowChoiceMessage({ body: 'Escolha:', options, listButtonLabel: 'Ver' })
    expect(message.kind).toBe('text')
    const body = message.kind === 'text' ? message.body : ''
    expect(Array.from(body).length).toBeLessThanOrEqual(WHATSAPP_CHOICE_LIMIT.TEXT_BODY_LENGTH)
    expect(body.startsWith('Escolha:\n\n1. ')).toBe(true)
    expect(body.endsWith('\n…')).toBe(true)
  })
})
