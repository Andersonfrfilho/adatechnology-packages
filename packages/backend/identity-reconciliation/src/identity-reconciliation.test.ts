import { describe, expect, test } from 'bun:test'

import {
  RECONCILIATION_MATCH,
  RECONCILIATION_STATUS,
  reconcileIdentities,
  type LocalIdentityRecord,
  type RealmIdentityRecord,
} from './index.js'

function localOf(overrides: Partial<LocalIdentityRecord> = {}): LocalIdentityRecord {
  return {
    document: '12345678909',
    emails: ['ana@empresa.test'],
    id: 'local-1',
    ...overrides,
  }
}

function realmOf(overrides: Partial<RealmIdentityRecord> = {}): RealmIdentityRecord {
  return {
    document: '',
    emails: ['ana@empresa.test'],
    subject: 'subject-1',
    ...overrides,
  }
}

describe('os degraus de confiança', () => {
  test('o vínculo gravado vence, e não depende de e-mail nenhum', () => {
    const [entry] = reconcileIdentities({
      local: [localOf({ emails: ['outro@empresa.test'], subject: 'subject-1' })],
      realm: [realmOf()],
    })

    expect(entry?.matchedBy).toBe(RECONCILIATION_MATCH.SUBJECT)
    expect(entry?.status).toBe(RECONCILIATION_STATUS.LINKED)
  })

  /**
   * A pessoa tem um documento e pode ter vários e-mails: o documento é o índice único, e casar por
   * e-mail primeiro duplicaria a mesma pessoa quando os dois lados guardam endereços diferentes.
   */
  test('quando os dois discordam, o documento vence o e-mail', () => {
    const [entry] = reconcileIdentities({
      local: [localOf()],
      realm: [
        realmOf({ emails: ['ana@empresa.test'], subject: 'por-email' }),
        realmOf({ document: '123.456.789-09', emails: ['pessoal@outro.test'], subject: 'por-doc' }),
      ],
    })

    expect(entry?.matchedBy).toBe(RECONCILIATION_MATCH.DOCUMENT)
    expect(entry?.realm?.subject).toBe('por-doc')
  })

  test('o documento casa sem máscara e sem depender de caixa', () => {
    const [entry] = reconcileIdentities({
      local: [localOf({ document: '12.abc.678/0001-90', emails: [] })],
      realm: [realmOf({ document: '12ABC6780001 90', emails: [] })],
    })

    expect(entry?.matchedBy).toBe(RECONCILIATION_MATCH.DOCUMENT)
  })
})

describe('e-mail é conjunto, não campo', () => {
  test('basta um endereço em comum, em qualquer posição das duas listas', () => {
    const [entry] = reconcileIdentities({
      local: [localOf({ document: '', emails: ['antigo@empresa.test', 'novo@empresa.test'] })],
      realm: [realmOf({ emails: ['pessoal@outro.test', 'NOVO@Empresa.test'] })],
    })

    expect(entry?.matchedBy).toBe(RECONCILIATION_MATCH.EMAIL)
    expect(entry?.matchedEmail).toBe('novo@empresa.test')
  })

  test('sem endereço em comum, ninguém casa', () => {
    const entries = reconcileIdentities({
      local: [localOf({ document: '', emails: ['a@empresa.test'] })],
      realm: [realmOf({ emails: ['b@empresa.test'] })],
    })

    expect(entries.map((entry) => entry.status)).toEqual([
      RECONCILIATION_STATUS.MISSING_IN_REALM,
      RECONCILIATION_STATUS.MISSING_LOCALLY,
    ])
  })

  test('lista vazia dos dois lados não vira casamento', () => {
    const entries = reconcileIdentities({
      local: [localOf({ document: '', emails: [] })],
      realm: [realmOf({ emails: [] })],
    })

    expect(entries).toHaveLength(2)
  })

  /** Endereço em branco no meio da lista é ruído de cadastro, não chave. */
  test('endereço em branco não casa com endereço em branco', () => {
    const entries = reconcileIdentities({
      local: [localOf({ document: '', emails: ['', '   '] })],
      realm: [realmOf({ emails: [''] })],
    })

    expect(entries.map((entry) => entry.status)).toEqual([
      RECONCILIATION_STATUS.MISSING_IN_REALM,
      RECONCILIATION_STATUS.MISSING_LOCALLY,
    ])
  })
})

describe('quem falta de cada lado', () => {
  test('vínculo sem conta no provedor é quem não consegue entrar', () => {
    const [entry] = reconcileIdentities({ local: [localOf()], realm: [] })
    expect(entry?.status).toBe(RECONCILIATION_STATUS.MISSING_IN_REALM)
  })

  test('conta no provedor sem vínculo aparece, em vez de sumir', () => {
    const [entry] = reconcileIdentities({ local: [], realm: [realmOf()] })
    expect(entry?.status).toBe(RECONCILIATION_STATUS.MISSING_LOCALLY)
  })

  test('os dois lados vazios não inventam linha', () => {
    expect(reconcileIdentities({ local: [], realm: [] })).toEqual([])
  })
})

describe('o que não pode casar', () => {
  test('documento em branco não casa com documento em branco', () => {
    const entries = reconcileIdentities({
      local: [localOf({ document: '', emails: [] })],
      realm: [realmOf({ document: '', emails: [] })],
    })

    expect(entries).toHaveLength(2)
  })

  test('uma conta do provedor serve a uma pessoa só', () => {
    const entries = reconcileIdentities({
      local: [localOf({ id: 'primeiro', subject: 'subject-1' }), localOf({ id: 'segundo' })],
      realm: [realmOf()],
    })

    expect(entries[0]?.status).toBe(RECONCILIATION_STATUS.LINKED)
    expect(entries[1]?.status).toBe(RECONCILIATION_STATUS.MISSING_IN_REALM)
  })

  test('chave repetida no provedor não duplica o casamento', () => {
    const entries = reconcileIdentities({
      local: [localOf({ document: '', emails: ['ana@empresa.test'] })],
      realm: [realmOf(), realmOf({ subject: 'subject-2' })],
    })

    expect(entries[0]?.status).toBe(RECONCILIATION_STATUS.LINKED)
    expect(entries[1]?.status).toBe(RECONCILIATION_STATUS.MISSING_LOCALLY)
    expect(entries[1]?.realm?.subject).toBe('subject-2')
  })
})
