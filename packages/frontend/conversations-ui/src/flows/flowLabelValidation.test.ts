/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rótulo de botão/linha com `{{variável}}`: o validador mede o texto interpolado, não a marcação.
 */

import { describe, expect, it } from 'bun:test'
import { validateGraph, measureLabel, type FlowGraphData } from './flowGraph'
import { DEFAULT_FLOW_EDITOR_LABELS } from './labels'

function menuGraph(label: string, extra: Record<string, unknown> = {}): FlowGraphData {
  return {
    key: 'main',
    label: 'Main',
    version: 1,
    startNodeId: 'menu',
    nodes: {
      menu: {
        id: 'menu',
        type: 'menu',
        question: 'Escolha',
        options: [['a', label]],
        next: { byAnswer: { a: 'menu' }, default: 'menu' },
        ...extra,
      },
    },
  } as FlowGraphData
}

const validate = (graph: FlowGraphData, variableExamples?: Record<string, string>) =>
  validateGraph(graph, DEFAULT_FLOW_EDITOR_LABELS.validation, variableExamples ? { variableExamples } : {})

describe('measureLabel', () => {
  it('measures the interpolated example, not the marker', () => {
    expect(measureLabel('✅ {{buttonName}}', { buttonName: 'Pernoite' })).toEqual({ length: 10, isApproximate: false })
  })

  it('counts a variable without example as zero and flags the measure as approximate', () => {
    expect(measureLabel('✅ {{buttonName}}')).toEqual({ length: 2, isApproximate: true })
  })
})

describe('validateGraph — labels with variables', () => {
  const LONG_MARKER = '✅ {{nameButtonTitle}}'

  it('does not error on a long marker without example; it warns', () => {
    const issues = validate(menuGraph(LONG_MARKER))
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(issues.some((issue) => issue.severity === 'warning' && issue.message.includes('pode passar de 20'))).toBe(
      true,
    )
  })

  it('passes silently when the example fits', () => {
    expect(validate(menuGraph(LONG_MARKER), { nameButtonTitle: 'Pernoite' })).toEqual([])
  })

  it('errors when the example does not fit the button limit', () => {
    const issues = validate(menuGraph(LONG_MARKER), { nameButtonTitle: 'Pacote de fim de semana inteiro' })
    expect(issues.map((issue) => issue.severity)).toEqual(['error'])
  })

  it('errors when the fixed part alone passes the limit', () => {
    const issues = validate(menuGraph('Texto fixo bem comprido demais {{x}}'))
    expect(issues.map((issue) => issue.severity)).toEqual(['error'])
  })

  it('keeps the strict check for labels without variables', () => {
    const issues = validate(menuGraph('Um rótulo comprido demais para botão'))
    expect(issues.map((issue) => issue.severity)).toEqual(['error'])
  })

  it('uses the list row limit (24) when the node renders a list', () => {
    const graph = menuGraph('{{unitName}} 12345678901234', { optionDetails: { a: { description: 'x' } } })
    expect(validate(graph, { unitName: 'Centro' }).filter((issue) => issue.severity === 'error')).toEqual([])
    expect(validate(graph, { unitName: 'Unidade Centro' }).map((issue) => issue.severity)).toEqual(['error'])
  })

  it('validates the list button label the same way', () => {
    expect(validate(menuGraph('A', { listButtonLabel: 'Horários {{unit}}' })).map((issue) => issue.severity)).toEqual(
      [],
    )
    expect(
      validate(menuGraph('A', { listButtonLabel: 'Horários {{unit}}' }), { unit: 'Unidade Centro' }).map(
        (issue) => issue.severity,
      ),
    ).toEqual(['error'])
    expect(
      validate(menuGraph('A', { listButtonLabel: 'Ver todos os horários disponíveis' })).map((i) => i.severity),
    ).toEqual(['error'])
  })
})
