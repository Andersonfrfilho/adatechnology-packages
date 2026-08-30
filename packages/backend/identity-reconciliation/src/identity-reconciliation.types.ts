/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * O contrato de vínculo, e ele é deliberadamente pobre: só o que serve para dizer que duas contas
 * são a mesma pessoa. Cada produto extrai o dele — coluna de perfil, contato de convite, atributo do
 * realm — e entrega nesta forma. Nada de canal, papel, situação ou vocabulário de domínio aqui:
 * o que entra neste tipo passa a valer para todos os produtos que o consomem.
 */

/**
 * O documento é o **índice único**: a pessoa tem um só, e é ele que decide quando as duas metades
 * discordam. Vazio significa "não cadastrado", nunca "vazio igual a vazio".
 */
export type IdentityDocument = string

/**
 * E-mails são **conjunto**, não campo. A mesma pessoa costuma ter mais de um endereço, e os dois
 * lados raramente guardam o mesmo: casar por um campo só faz a mesma pessoa aparecer duas vezes.
 * A ordem não significa nada — quem quiser um "principal" o guarda fora deste contrato.
 */
export type IdentityEmails = readonly string[]

export type LocalIdentityRecord = {
  /**
   * O identificador da pessoa **no produto**. Ele volta no resultado e é por ele que quem chamou
   * reencontra o registro dele: a política não conhece o resto da ficha.
   */
  readonly id: string
  readonly document: IdentityDocument
  readonly emails: IdentityEmails
  /**
   * O `sub` do provedor, quando o produto já o gravou. É o degrau mais confiável porque não é
   * palpite: alguém o escreveu no momento em que as duas contas foram criadas juntas.
   */
  readonly subject?: string
}

export type RealmIdentityRecord = {
  readonly subject: string
  readonly document: IdentityDocument
  readonly emails: IdentityEmails
}

export const RECONCILIATION_STATUS = {
  /** Existe nos dois lados. */
  LINKED: 'linked',
  /** Existe só no provedor — ninguém no produto responde por ela. */
  MISSING_LOCALLY: 'missing-locally',
  /** Existe só no produto — quem tem vínculo aqui não consegue entrar. */
  MISSING_IN_REALM: 'missing-in-realm',
} as const
export type ReconciliationStatus = (typeof RECONCILIATION_STATUS)[keyof typeof RECONCILIATION_STATUS]

/**
 * Por qual chave as duas metades casaram. Sai no resultado porque a confiança do vínculo é
 * diferente em cada degrau, e quem decide o que fazer com a divergência precisa saber disso.
 */
export const RECONCILIATION_MATCH = {
  EMAIL: 'email',
  NONE: 'none',
  SUBJECT: 'subject',
  DOCUMENT: 'document',
} as const
export type ReconciliationMatch = (typeof RECONCILIATION_MATCH)[keyof typeof RECONCILIATION_MATCH]

export type ReconciliationEntry = {
  readonly local?: LocalIdentityRecord
  /** O e-mail que casou, quando o degrau foi o e-mail: com vários, dizer qual poupa a investigação. */
  readonly matchedEmail?: string
  readonly matchedBy: ReconciliationMatch
  readonly realm?: RealmIdentityRecord
  readonly status: ReconciliationStatus
}

export type ReconcileIdentitiesInput = {
  readonly local: readonly LocalIdentityRecord[]
  readonly realm: readonly RealmIdentityRecord[]
}
