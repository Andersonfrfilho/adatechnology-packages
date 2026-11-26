/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `dynamic_choice` com `unmatchedChoice: 'default'` e `matchByPosition: false`: a lista oferece atalhos
 * e o cliente ainda pode digitar o número que quer ("quantas pessoas").
 */

import { describe, expect, it } from 'bun:test'
import { COMPANY_ID, buildRunner, graph, textMessage } from './flowRunnerHarness'

function quantityRunner(extra: { matchByPosition?: boolean } = {}) {
  return buildRunner({
    graphs: [
      graph('main', 'people', [
        {
          id: 'people',
          type: 'dynamic_choice',
          question: 'Quantas pessoas?',
          choiceProvider: 'people',
          contextKey: 'people',
          unmatchedChoice: 'default',
          ...extra,
          next: 'done',
        },
        { id: 'done', type: 'action', directMessage: 'Anotado: {{people}}' },
      ]),
    ],
    config: {
      dynamicChoiceProviders: {
        people: async () => ({
          options: [
            { id: '1', title: '1 pessoa' },
            { id: '2', title: '2 pessoas' },
            { id: 'more', title: 'Mais de 10 pessoas' },
          ],
          hasMore: false,
        }),
      },
    },
  })
}

describe('FlowRunner — dynamic choice with a typed answer', () => {
  it('follows the default with the typed text instead of re-asking', async () => {
    const harness = quantityRunner({ matchByPosition: false })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('12'))
    expect(harness.takeSent()).toEqual([{ kind: 'text', body: 'Anotado: 12' }])
  })

  it('still takes a tapped row and an id typed out', async () => {
    const harness = quantityRunner({ matchByPosition: false })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('2'))
    expect(harness.row.context['people']).toBe('2')
  })

  it('a number typed does not pick the row at that position when matchByPosition is false', async () => {
    const harness = quantityRunner({ matchByPosition: false })
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('3'))
    expect(harness.row.context['people']).toBe('3')
  })

  it('by default a typed number picks the row at that position', async () => {
    const harness = quantityRunner()
    await harness.handle(textMessage('oi'))
    harness.takeSent()
    await harness.handle(textMessage('3'))
    expect(harness.row.context['people']).toBe('more')
    expect(COMPANY_ID).toBeTruthy()
  })
})
