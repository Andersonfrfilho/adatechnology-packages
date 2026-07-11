/**
 * Grupo IBS/CBS da Reforma Tributária do Consumo (NT 2025.002 / LC 214/2025).
 *
 * A partir de 05/01/2026 o ambiente de homologação SEFAZ passou a rejeitar NFC-e/NF-e
 * sem o grupo IBS/CBS por item (cStat 1115 — "IBS/CBS não informado").
 *
 * Durante a fase de teste (2026) as alíquotas são simbólicas: IBS 0,1% e CBS 0,9%.
 * O grupo é gerado com CST 000 (Tributação integral) por padrão, com valores calculados
 * a partir da base de cálculo de cada item para satisfazer as regras de arredondamento.
 */

export const IBSCBS_DEFAULT = {
  CST: '000',
  CLASS_TRIB: '000001',
  P_IBS_UF: 0.1,
  P_IBS_MUN: 0.0,
  P_CBS: 0.9,
} as const

export type IbsCbsRates = {
  readonly cst: string
  readonly classTrib: string
  readonly pIbsUf: number
  readonly pIbsMun: number
  readonly pCbs: number
}

export type IbsCbsAmounts = {
  readonly vBC: number
  readonly vIbsUf: number
  readonly vIbsMun: number
  readonly vIbs: number
  readonly vCbs: number
}

export type BuildIbsCbsItemParams = {
  readonly baseCalculo: number
  readonly rates: IbsCbsRates
}

export type BuildIbsCbsItemResult = {
  readonly xml: string
  readonly amounts: IbsCbsAmounts
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function resolveIbsCbsRates(overrides?: Partial<IbsCbsRates>): IbsCbsRates {
  return {
    cst: overrides?.cst ?? IBSCBS_DEFAULT.CST,
    classTrib: overrides?.classTrib ?? IBSCBS_DEFAULT.CLASS_TRIB,
    pIbsUf: overrides?.pIbsUf ?? IBSCBS_DEFAULT.P_IBS_UF,
    pIbsMun: overrides?.pIbsMun ?? IBSCBS_DEFAULT.P_IBS_MUN,
    pCbs: overrides?.pCbs ?? IBSCBS_DEFAULT.P_CBS,
  }
}

/** Monta o grupo IBSCBS de um item (dentro de <imposto>) e devolve os valores para o total. */
export function buildIbsCbsItem({ baseCalculo, rates }: BuildIbsCbsItemParams): BuildIbsCbsItemResult {
  const vIbsUf = round2((baseCalculo * rates.pIbsUf) / 100)
  const vIbsMun = round2((baseCalculo * rates.pIbsMun) / 100)
  const vIbs = round2(vIbsUf + vIbsMun)
  const vCbs = round2((baseCalculo * rates.pCbs) / 100)

  const xml =
    `<IBSCBS>` +
    `<CST>${rates.cst}</CST>` +
    `<cClassTrib>${rates.classTrib}</cClassTrib>` +
    `<gIBSCBS>` +
    `<vBC>${baseCalculo.toFixed(2)}</vBC>` +
    `<gIBSUF><pIBSUF>${rates.pIbsUf.toFixed(4)}</pIBSUF><vIBSUF>${vIbsUf.toFixed(2)}</vIBSUF></gIBSUF>` +
    `<gIBSMun><pIBSMun>${rates.pIbsMun.toFixed(4)}</pIBSMun><vIBSMun>${vIbsMun.toFixed(2)}</vIBSMun></gIBSMun>` +
    `<vIBS>${vIbs.toFixed(2)}</vIBS>` +
    `<gCBS><pCBS>${rates.pCbs.toFixed(4)}</pCBS><vCBS>${vCbs.toFixed(2)}</vCBS></gCBS>` +
    `</gIBSCBS>` +
    `</IBSCBS>`

  return { xml, amounts: { vBC: baseCalculo, vIbsUf, vIbsMun, vIbs, vCbs } }
}

/** Monta o grupo IBSCBSTot (dentro de <total>) somando os itens. */
export function buildIbsCbsTotal(itemAmounts: readonly IbsCbsAmounts[]): string {
  const sum = (selector: (amount: IbsCbsAmounts) => number): string =>
    round2(itemAmounts.reduce((total, amount) => total + selector(amount), 0)).toFixed(2)

  return (
    `<IBSCBSTot>` +
    `<vBCIBSCBS>${sum((amount) => amount.vBC)}</vBCIBSCBS>` +
    `<gIBS>` +
    `<gIBSUF><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>${sum((amount) => amount.vIbsUf)}</vIBSUF></gIBSUF>` +
    `<gIBSMun><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>${sum((amount) => amount.vIbsMun)}</vIBSMun></gIBSMun>` +
    `<vIBS>${sum((amount) => amount.vIbs)}</vIBS>` +
    `<vCredPres>0.00</vCredPres>` +
    `<vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gIBS>` +
    `<gCBS>` +
    `<vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vCBS>${sum((amount) => amount.vCbs)}</vCBS>` +
    `<vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus>` +
    `</gCBS>` +
    `</IBSCBSTot>`
  )
}
