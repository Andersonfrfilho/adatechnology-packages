/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { RECONCILIATION_STATUS } from './identity-reconciliation.types.js'

/**
 * O quarto estado, e ele é **de leitura**, não de casamento.
 *
 * `RECONCILIATION_STATUS` responde "as duas contas são a mesma pessoa?", e por isso o contrato dele
 * é pobre de propósito. Este responde outra pergunta: a conta existe dos dois lados **e** a ficha do
 * produto está ausente. É completude, não existência — e é genérico porque todo produto com login
 * federado tem uma tabela de perfil que pode não ter linha para quem já entra.
 *
 * Ele vive num conjunto separado justamente para não engordar o contrato de casamento: quem só
 * reconcilia continua sem precisar saber que ficha existe.
 */
export const RECONCILIATION_VIEW_STATUS = {
  ...RECONCILIATION_STATUS,
  /** Casado e sem ficha no produto: existe dos dois lados, e não há o que mostrar. */
  PROFILE_MISSING: 'profile-missing',
} as const
export type ReconciliationViewStatus = (typeof RECONCILIATION_VIEW_STATUS)[keyof typeof RECONCILIATION_VIEW_STATUS]

/**
 * O mínimo que o resumo precisa ler. Genérico sobre o resto da entrada de propósito: cada produto
 * chama o identificador local do jeito dele (`userId`, `accountId`, `id`), e exigir um nome forçaria
 * quem consome a remapear a lista inteira só para contar.
 */
type StatusBearing = { readonly status: string }

export type ReconciliationSummary<TEntry extends StatusBearing> = {
  /** O total que precisa de conserto — a soma das duas listas, e nunca a base de um botão só. */
  readonly divergent: number
  /** Existe de um lado só. É o que a sincronização conserta, e o que ela tem para enviar. */
  readonly missingSomewhere: readonly TEntry[]
  /** Existe dos dois lados sem ficha no produto. É o que o preenchimento conserta. */
  readonly withoutProfile: readonly TEntry[]
}

/**
 * Separa as duas divergências, que são de naturezas diferentes e têm conserto diferente.
 *
 * Somá-las num número só é o erro que esta função existe para impedir: uma tela que anunciava
 * "1 acesso existe em um lado só" tirando o número do total mandava, ao clique, dois conjuntos
 * vazios para a rota de sincronização — porque a única divergência era ficha vazia, que aquela rota
 * não conserta. A API respondia certo (nada a criar) e a tela ficava idêntica, como se o botão
 * estivesse quebrado. Contar junto o que se conserta separado sempre produz esse silêncio.
 */
export function summarizeReconciliation<TEntry extends StatusBearing>(
  entries: readonly TEntry[],
): ReconciliationSummary<TEntry> {
  const missingSomewhere = entries.filter(
    (entry) =>
      entry.status === RECONCILIATION_VIEW_STATUS.MISSING_IN_REALM ||
      entry.status === RECONCILIATION_VIEW_STATUS.MISSING_LOCALLY,
  )
  const withoutProfile = entries.filter((entry) => entry.status === RECONCILIATION_VIEW_STATUS.PROFILE_MISSING)

  return {
    divergent: missingSomewhere.length + withoutProfile.length,
    missingSomewhere,
    withoutProfile,
  }
}

export type ExistencePartition<TEntry extends StatusBearing> = {
  /** Só no provedor: o conserto é trazer para o produto. */
  readonly missingLocally: readonly TEntry[]
  /** Só no produto: o conserto é criar no provedor. */
  readonly missingInRealm: readonly TEntry[]
}

/**
 * Os dois sentidos da sincronização, separados. Quem chama extrai daqui o identificador que o
 * endpoint dele espera — o `subject` de um lado, a chave local do outro —, e essa extração é a
 * única parte que o pacote não pode fazer sem conhecer o nome do campo de cada produto.
 *
 * As duas listas vazias é a resposta honesta para "não há o que sincronizar", e é o sinal de que o
 * botão não deveria estar na tela.
 */
export function partitionByExistence<TEntry extends StatusBearing>(
  entries: readonly TEntry[],
): ExistencePartition<TEntry> {
  return {
    missingInRealm: entries.filter((entry) => entry.status === RECONCILIATION_VIEW_STATUS.MISSING_IN_REALM),
    missingLocally: entries.filter((entry) => entry.status === RECONCILIATION_VIEW_STATUS.MISSING_LOCALLY),
  }
}
