/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { WHATSAPP_CHOICE_LIMIT } from '@adatechnology/meta-whatsapp-contracts'
import {
  countCharacters,
  rendersAsButtons,
  targetsOf,
  validateGraph,
  WHATSAPP_LIMITS,
  type FlowGraphData,
} from './flowGraph'
import { applyConnection, clearConnection } from './flowEditorOps'
import { DEFAULT_FLOW_EDITOR_LABELS, mergeFlowEditorLabels } from './labels'

describe('editor limits come from the contract', () => {
  it('mirrors WHATSAPP_CHOICE_LIMIT', () => {
    expect(WHATSAPP_LIMITS.MAX_BUTTONS).toBe(WHATSAPP_CHOICE_LIMIT.BUTTONS)
    expect(WHATSAPP_LIMITS.LIST_ROW_DESCRIPTION_MAX).toBe(WHATSAPP_CHOICE_LIMIT.LIST_ROW_DESCRIPTION_LENGTH)
  })

  it('counts an emoji as one character, like the contract', () => {
    expect(countCharacters('🙋 Atendente')).toBe(11)
  })

  it('renders a list when an option has a description or section', () => {
    const options: [string, string][] = [['a', 'A']]
    expect(rendersAsButtons(options)).toBe(true)
    expect(rendersAsButtons(options, { a: { description: 'detalhe' } })).toBe(false)
  })
})

describe('keyword routes in the editor', () => {
  const node = {
    id: 'menu',
    type: 'menu' as const,
    options: [['a', 'A']] as [string, string][],
    next: { byAnswer: { a: 'x' }, byKeyword: { horario: 'hours' }, default: 'menu' },
  }

  it('lists keyword targets', () => {
    expect(targetsOf(node)).toContainEqual({ target: 'hours', keyword: 'horario' })
  })

  it('keeps keyword routes when connecting an option and edits them through kw: handles', () => {
    const connected = applyConnection(node, { flowKey: 'main', nodeId: 'menu', handle: 'a', targetValue: 'y' })
    expect(connected.next).toMatchObject({ byKeyword: { horario: 'hours' }, byAnswer: { a: 'y' } })
    const rerouted = applyConnection(node, { flowKey: 'main', nodeId: 'menu', handle: 'kw:horario', targetValue: 'z' })
    expect(rerouted.next).toMatchObject({ byKeyword: { horario: 'z' }, byAnswer: { a: 'x' } })
    expect(clearConnection(node, 'kw:horario').next).toMatchObject({ byKeyword: { horario: '' } })
  })
})

describe('validateGraph — runner fields', () => {
  it('flags long descriptions and dynamic choices without provider', () => {
    const graph: FlowGraphData = {
      key: 'main',
      label: 'main',
      startNodeId: 'menu',
      version: 1,
      nodes: {
        menu: {
          id: 'menu',
          type: 'menu',
          options: [['a', 'A']],
          optionDetails: { a: { description: 'x'.repeat(73) } },
          next: { byAnswer: { a: 'slot' }, default: 'menu' },
        },
        slot: { id: 'slot', type: 'dynamic_choice' },
      },
    }
    const messages = validateGraph(graph, DEFAULT_FLOW_EDITOR_LABELS.validation).map((issue) => issue.message)
    expect(messages).toContain('Nó "menu": a descrição de "A" passa de 72 caracteres.')
    expect(messages).toContain('Nó "slot": escolha dinâmica sem provedor de opções.')
  })
})

describe('validateGraph — unmatched choice', () => {
  const base = (unmatchedChoice?: 'reask' | 'default'): FlowGraphData => ({
    key: 'main',
    label: 'main',
    startNodeId: 'menu',
    version: 1,
    nodes: {
      menu: {
        id: 'menu',
        type: 'menu',
        options: [['a', 'A']],
        ...(unmatchedChoice ? { unmatchedChoice } : {}),
        next: { byAnswer: { a: 'other' }, default: 'other' },
      },
      other: { id: 'other', type: 'action' },
    },
  })

  it('warns when a choice default would be ignored by the runner', () => {
    const issues = validateGraph(base(), DEFAULT_FLOW_EDITOR_LABELS.validation)
    expect(issues.some((issue) => issue.severity === 'warning' && issue.message.includes('Caso contrário'))).toBe(true)
  })

  it('does not warn when the node follows default', () => {
    const issues = validateGraph(base('default'), DEFAULT_FLOW_EDITOR_LABELS.validation)
    expect(issues.some((issue) => issue.message.includes('Caso contrário'))).toBe(false)
  })
})

describe('labels — hosts that build the legend by hand', () => {
  it('accepts a legend without dynamic_choice and merges the default', () => {
    const legend = { question: 'Q', entrada_choice: 'E', action: 'A', menu: 'M', condition: 'C' }
    const merged = mergeFlowEditorLabels({ legend })
    expect(merged.legend.dynamic_choice).toBe(DEFAULT_FLOW_EDITOR_LABELS.legend.dynamic_choice)
    expect(merged.legend.menu).toBe('M')
  })
})
