/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { partitionByExistence, RECONCILIATION_VIEW_STATUS, summarizeReconciliation } from './index.js'

/** A forma mínima que o resumo lê, mais um campo de produto para provar que ele atravessa. */
type Entry = { readonly status: string; readonly ticket: string }

function entryOf(status: string, ticket: string): Entry {
  return { status, ticket }
}

describe('o resumo separa existência de completude', () => {
  test('ficha ausente não conta como acesso a criar', () => {
    const summary = summarizeReconciliation([entryOf(RECONCILIATION_VIEW_STATUS.PROFILE_MISSING, 'a')])

    expect(summary.missingSomewhere).toHaveLength(0)
    expect(summary.withoutProfile).toHaveLength(1)
    expect(summary.divergent).toBe(1)
  })

  test('as duas divergências somam no total e continuam separadas', () => {
    const summary = summarizeReconciliation([
      entryOf(RECONCILIATION_VIEW_STATUS.PROFILE_MISSING, 'a'),
      entryOf(RECONCILIATION_VIEW_STATUS.MISSING_IN_REALM, 'b'),
      entryOf(RECONCILIATION_VIEW_STATUS.MISSING_LOCALLY, 'c'),
      entryOf(RECONCILIATION_VIEW_STATUS.LINKED, 'd'),
    ])

    expect(summary.divergent).toBe(3)
    expect(summary.missingSomewhere.map((entry) => entry.ticket)).toEqual(['b', 'c'])
    expect(summary.withoutProfile.map((entry) => entry.ticket)).toEqual(['a'])
  })

  test('o casado e completo não é divergência', () => {
    const summary = summarizeReconciliation([entryOf(RECONCILIATION_VIEW_STATUS.LINKED, 'a')])

    expect(summary.divergent).toBe(0)
  })

  /** Estado que um produto invente não pode virar alvo de conserto por engano. */
  test('estado desconhecido não entra em nenhuma das duas listas', () => {
    const summary = summarizeReconciliation([entryOf('estado-do-futuro', 'a')])

    expect(summary.divergent).toBe(0)
    expect(summary.missingSomewhere).toHaveLength(0)
    expect(summary.withoutProfile).toHaveLength(0)
  })

  /** A entrada volta inteira: quem chama precisa do resto da ficha para montar o pedido. */
  test('a entrada do produto atravessa o resumo sem ser reescrita', () => {
    const entry = entryOf(RECONCILIATION_VIEW_STATUS.MISSING_LOCALLY, 'ticket-42')

    expect(summarizeReconciliation([entry]).missingSomewhere[0]).toBe(entry)
  })
})

describe('os dois sentidos da sincronização ficam separados', () => {
  test('cada sentido recebe só o que lhe pertence', () => {
    const partition = partitionByExistence([
      entryOf(RECONCILIATION_VIEW_STATUS.MISSING_IN_REALM, 'a'),
      entryOf(RECONCILIATION_VIEW_STATUS.MISSING_LOCALLY, 'b'),
      entryOf(RECONCILIATION_VIEW_STATUS.PROFILE_MISSING, 'c'),
      entryOf(RECONCILIATION_VIEW_STATUS.LINKED, 'd'),
    ])

    expect(partition.missingInRealm.map((entry) => entry.ticket)).toEqual(['a'])
    expect(partition.missingLocally.map((entry) => entry.ticket)).toEqual(['b'])
  })

  /** Duas listas vazias é o sinal de que o botão de sincronizar não deveria estar na tela. */
  test('só ficha ausente não produz alvo de sincronização', () => {
    const partition = partitionByExistence([entryOf(RECONCILIATION_VIEW_STATUS.PROFILE_MISSING, 'a')])

    expect(partition.missingInRealm).toHaveLength(0)
    expect(partition.missingLocally).toHaveLength(0)
  })
})

describe('o quarto estado não invade o contrato de casamento', () => {
  test('o conjunto de leitura contém os três de casamento e mais um', () => {
    expect(RECONCILIATION_VIEW_STATUS.LINKED).toBe('linked')
    expect(RECONCILIATION_VIEW_STATUS.MISSING_LOCALLY).toBe('missing-locally')
    expect(RECONCILIATION_VIEW_STATUS.MISSING_IN_REALM).toBe('missing-in-realm')
    expect(RECONCILIATION_VIEW_STATUS.PROFILE_MISSING).toBe('profile-missing')
  })
})
