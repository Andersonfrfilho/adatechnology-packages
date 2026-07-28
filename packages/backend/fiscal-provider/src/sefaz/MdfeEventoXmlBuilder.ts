import { MDFE_NS, MDFE_VERSAO } from './MdfeConstants'

export const MDFE_TP_EVENTO = {
  cancelamento: '110111',
  encerramento: '110112',
} as const

export type MdfeTpEvento = (typeof MDFE_TP_EVENTO)[keyof typeof MDFE_TP_EVENTO]

type MdfeEventoBase = {
  readonly cOrgao: string
  readonly tpAmb: '1' | '2'
  readonly cnpj: string
  readonly chaveAcesso: string
  readonly dhEvento: string
  readonly nSeqEvento: number
}

export type MdfeEventoXmlResult = {
  readonly xml: string
  readonly id: string
}

export function buildMdfeEncerramentoXml(
  params: MdfeEventoBase & {
    readonly protocolo: string
    readonly dataEncerramento: string
    readonly cUfEncerramento: string
    readonly codigoMunicipioEncerramento: string
    readonly encerradoPorTerceiro?: boolean
  },
): MdfeEventoXmlResult {
  // indEncPorTerceiro só existe com valor fixo "1" — omitir é o encerramento pelo próprio emitente
  const indEncPorTerceiro = params.encerradoPorTerceiro === true ? '<indEncPorTerceiro>1</indEncPorTerceiro>' : ''
  const detEvento =
    `<evEncMDFe><descEvento>Encerramento</descEvento><nProt>${params.protocolo}</nProt>` +
    `<dtEnc>${params.dataEncerramento}</dtEnc><cUF>${params.cUfEncerramento}</cUF>` +
    `<cMun>${params.codigoMunicipioEncerramento}</cMun>${indEncPorTerceiro}</evEncMDFe>`

  return buildEventoXml(MDFE_TP_EVENTO.encerramento, params, detEvento)
}

export function buildMdfeCancelamentoXml(
  params: MdfeEventoBase & {
    readonly protocolo: string
    readonly justificativa: string
  },
): MdfeEventoXmlResult {
  const detEvento =
    `<evCancMDFe><descEvento>Cancelamento</descEvento><nProt>${params.protocolo}</nProt>` +
    `<xJust>${escapeXml(params.justificativa)}</xJust></evCancMDFe>`

  return buildEventoXml(MDFE_TP_EVENTO.cancelamento, params, detEvento)
}

function buildEventoXml(tpEvento: MdfeTpEvento, base: MdfeEventoBase, detEvento: string): MdfeEventoXmlResult {
  const id = `ID${tpEvento}${base.chaveAcesso}${String(base.nSeqEvento).padStart(2, '0')}`

  // O detEvento do MDF-e carrega versaoEvento — o CT-e usa versao no mesmo lugar
  const xml =
    `<eventoMDFe versao="${MDFE_VERSAO}" xmlns="${MDFE_NS}"><infEvento Id="${id}">` +
    `<cOrgao>${base.cOrgao}</cOrgao><tpAmb>${base.tpAmb}</tpAmb><CNPJ>${base.cnpj}</CNPJ>` +
    `<chMDFe>${base.chaveAcesso}</chMDFe><dhEvento>${base.dhEvento}</dhEvento>` +
    `<tpEvento>${tpEvento}</tpEvento><nSeqEvento>${base.nSeqEvento}</nSeqEvento>` +
    `<detEvento versaoEvento="${MDFE_VERSAO}">${detEvento}</detEvento>` +
    `</infEvento></eventoMDFe>`

  return { xml, id }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
