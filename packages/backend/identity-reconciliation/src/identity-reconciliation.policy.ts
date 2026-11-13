/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import {
  RECONCILIATION_MATCH,
  RECONCILIATION_STATUS,
  type LocalIdentityRecord,
  type ReconcileIdentitiesInput,
  type ReconciliationEntry,
  type ReconciliationMatch,
  type RealmIdentityRecord,
} from './identity-reconciliation.types.js'

/**
 * A ordem é a da confiança, e ela não é negociável:
 *
 * - `subject` é identidade, não palpite — alguém a gravou quando as duas contas nasceram juntas;
 * - **documento antes de e-mail**: a pessoa tem um documento e pode ter vários e-mails, então o
 *   documento é o índice único e o e-mail é desempate;
 * - e-mail por último, e por **interseção de conjuntos**: basta um endereço em comum.
 */
const MATCH_ORDER = [RECONCILIATION_MATCH.SUBJECT, RECONCILIATION_MATCH.DOCUMENT, RECONCILIATION_MATCH.EMAIL] as const

/** Caixa e espaço não são identidade: `Ana@X.test` e `ana@x.test` são a mesma caixa postal. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Máscara não é identidade. A normalização remove tudo que não é alfanumérico e sobe a caixa —
 * serve para CPF, CNPJ (que tem letra desde 2026), NIF, VAT e o que mais o produto usar como
 * documento, sem que este pacote precise conhecer nenhum deles.
 */
export function normalizeDocument(value: string): string {
  return value.replace(/[^0-9a-z]/giu, '').toUpperCase()
}

function normalizedEmailsOf(record: LocalIdentityRecord | RealmIdentityRecord): readonly string[] {
  return record.emails.map(normalizeEmail).filter((email) => email !== '')
}

/**
 * Chave em branco nunca casa com chave em branco: duas pessoas sem documento cadastrado não são a
 * mesma pessoa, e tratá-las como uma esconde uma das duas para sempre.
 *
 * Chave repetida no provedor é anomalia dele, não escolha nossa: o primeiro vence, e o segundo
 * aparece como divergência em vez de sumir.
 */
function indexBy(
  records: readonly RealmIdentityRecord[],
  keysOf: (record: RealmIdentityRecord) => readonly string[],
): ReadonlyMap<string, RealmIdentityRecord> {
  const index = new Map<string, RealmIdentityRecord>()
  for (const record of records) {
    for (const key of keysOf(record)) {
      if (key === '') continue
      if (!index.has(key)) index.set(key, record)
    }
  }
  return index
}

export function reconcileIdentities({ local, realm }: ReconcileIdentitiesInput): readonly ReconciliationEntry[] {
  const indexes = {
    [RECONCILIATION_MATCH.SUBJECT]: indexBy(realm, (record) => [record.subject]),
    [RECONCILIATION_MATCH.DOCUMENT]: indexBy(realm, (record) => [normalizeDocument(record.document)]),
    [RECONCILIATION_MATCH.EMAIL]: indexBy(realm, normalizedEmailsOf),
  } as const

  const claimed = new Set<string>()
  const entries: ReconciliationEntry[] = []

  for (const record of local) {
    const matched = matchLocal({ claimed, indexes, record })
    if (matched === undefined) {
      entries.push({
        local: record,
        matchedBy: RECONCILIATION_MATCH.NONE,
        status: RECONCILIATION_STATUS.MISSING_IN_REALM,
      })
      continue
    }
    claimed.add(matched.realm.subject)
    entries.push({
      local: record,
      matchedBy: matched.matchedBy,
      realm: matched.realm,
      status: RECONCILIATION_STATUS.LINKED,
      ...(matched.matchedEmail === undefined ? {} : { matchedEmail: matched.matchedEmail }),
    })
  }

  for (const record of realm) {
    if (claimed.has(record.subject)) continue
    entries.push({
      matchedBy: RECONCILIATION_MATCH.NONE,
      realm: record,
      status: RECONCILIATION_STATUS.MISSING_LOCALLY,
    })
  }

  return entries
}

type Match = {
  readonly matchedBy: ReconciliationMatch
  readonly matchedEmail?: string
  readonly realm: RealmIdentityRecord
}

function matchLocal({
  claimed,
  indexes,
  record,
}: Readonly<{
  claimed: ReadonlySet<string>
  indexes: Readonly<Record<string, ReadonlyMap<string, RealmIdentityRecord>>>
  record: LocalIdentityRecord
}>): Match | undefined {
  for (const matchedBy of MATCH_ORDER) {
    const index = indexes[matchedBy]
    if (index === undefined) continue

    for (const key of keysFor({ matchedBy, record })) {
      if (key === '') continue
      const found = index.get(key)
      // Já reivindicado por outra pessoa daqui: descer um degrau, não roubar o vínculo alheio.
      if (found === undefined || claimed.has(found.subject)) continue
      return matchedBy === RECONCILIATION_MATCH.EMAIL
        ? { matchedBy, matchedEmail: key, realm: found }
        : { matchedBy, realm: found }
    }
  }

  return undefined
}

/** O e-mail é o único degrau com mais de uma chave: qualquer endereço em comum basta. */
function keysFor({
  matchedBy,
  record,
}: Readonly<{
  matchedBy: ReconciliationMatch
  record: LocalIdentityRecord
}>): readonly string[] {
  if (matchedBy === RECONCILIATION_MATCH.SUBJECT) return [record.subject ?? '']
  if (matchedBy === RECONCILIATION_MATCH.DOCUMENT) return [normalizeDocument(record.document)]
  return normalizedEmailsOf(record)
}
