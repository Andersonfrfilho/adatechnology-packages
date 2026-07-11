import type { EmitFiscalParams, NfceConfig } from '../types'
import type { ChaveAcesso } from './SefazChave'
import { UF_IBGE_CODES } from './SefazConstants'
import { toNfcePaymentCode } from '../utils/mapPaymentMethod'
import { formatDhEmi } from './SefazDateTime'
import { buildIbsCbsItem, buildIbsCbsTotal, resolveIbsCbsRates, type IbsCbsAmounts } from './IbsCbsBuilder'

/** Códigos tPag que exigem o grupo <card> (cartão + arranjos eletrônicos). */
const TPAG_REQUER_CARD = new Set(['03', '04', '17', '18'])

type BuildNfceXmlParams = {
  readonly params: EmitFiscalParams
  readonly config: NfceConfig
  readonly chave: ChaveAcesso
  readonly dataEmissao: Date
}

/**
 * Gera XML NFC-e (modelo 65) compacto — SEFAZ-SP rejeita whitespace entre tags (cStat 225).
 */
export function buildNfceXml({ params, config, chave, dataEmissao }: BuildNfceXmlParams): string {
  const tpAmb = config.environment === 'producao' ? '1' : '2'
  const cUF = UF_IBGE_CODES[config.uf] ?? '00'
  const dhEmi = formatDhEmi(dataEmissao)
  const serieNum = String(parseInt(config.serie, 10) || 1)
  const ie = config.inscricaoEstadual.replace(/\D/g, '') || 'ISENTO'
  const totalProdutos = params.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)
  const totalNf = params.totalAmount.toFixed(2)
  const totalDesc = (params.discountAmount ?? 0).toFixed(2)
  const cnpj = config.cnpj.replace(/\D/g, '')
  const cep = config.cep.replace(/\D/g, '').padStart(8, '0')

  // Homologação: primeiro item deve identificar ambiente (evita cStat 598)
  const items =
    tpAmb === '2' && params.items.length > 0
      ? [
          {
            ...params.items[0]!,
            descricao: 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
          },
          ...params.items.slice(1),
        ]
      : params.items

  const ibsCbsRates = resolveIbsCbsRates(config.ibsCbs)
  const ibsCbsAmounts: IbsCbsAmounts[] = []

  const itensXml = items
    .map((item, index) => {
      const ncm = (item.ncm ?? '').replace(/\D/g, '').padStart(8, '0').slice(0, 8)
      const cfop = (item.cfop ?? '5102').replace(/\D/g, '').slice(0, 4)
      const ibsCbs = buildIbsCbsItem({ baseCalculo: item.valorTotal, rates: ibsCbsRates })
      ibsCbsAmounts.push(ibsCbs.amounts)
      return (
        `<det nItem="${index + 1}">` +
        `<prod>` +
        `<cProd>${escapeXml(item.codigo)}</cProd>` +
        `<cEAN>SEM GTIN</cEAN>` +
        `<xProd>${escapeXml(item.descricao.slice(0, 120))}</xProd>` +
        `<NCM>${ncm}</NCM>` +
        `<CFOP>${cfop}</CFOP>` +
        `<uCom>${escapeXml(item.unidade)}</uCom>` +
        `<qCom>${item.quantidade.toFixed(4)}</qCom>` +
        `<vUnCom>${item.valorUnitario.toFixed(10)}</vUnCom>` +
        `<vProd>${item.valorTotal.toFixed(2)}</vProd>` +
        `<cEANTrib>SEM GTIN</cEANTrib>` +
        `<uTrib>${escapeXml(item.unidade)}</uTrib>` +
        `<qTrib>${item.quantidade.toFixed(4)}</qTrib>` +
        `<vUnTrib>${item.valorUnitario.toFixed(10)}</vUnTrib>` +
        `<indTot>1</indTot>` +
        `</prod>` +
        `<imposto>` +
        `<vTotTrib>0.00</vTotTrib>` +
        `${buildIcmsXml(item.cst ?? '', config.crt)}` +
        `<PIS><PISNT><CST>07</CST></PISNT></PIS>` +
        `<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>` +
        `${ibsCbs.xml}` +
        `</imposto>` +
        `</det>`
      )
    })
    .join('')

  const pagXml = params.payments
    .map((payment) => {
      const tPag = toNfcePaymentCode(payment.method as never)
      // SEFAZ exige o grupo <card><tpIntegra> para cartão (03/04) e arranjos eletrônicos
      // como PIX/carteira digital (17/18) — cStat 391 caso ausente. tpIntegra=2 (não integrado).
      const card = TPAG_REQUER_CARD.has(tPag) ? `<card><tpIntegra>2</tpIntegra></card>` : ''
      return `<detPag><tPag>${tPag}</tPag><vPag>${payment.amount.toFixed(2)}</vPag>${card}</detPag>`
    })
    .join('')
  const totalPago = params.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const vTroco = Math.max(totalPago - params.totalAmount, 0).toFixed(2)

  const destXml = params.customerCpf
    ? `<dest><CPF>${params.customerCpf.replace(/\D/g, '')}</CPF><indIEDest>9</indIEDest></dest>`
    : ''

  // indPres=1 (presencial): não informar indIntermed — evita cStat 225 em várias UFs
  const ide =
    `<ide>` +
    `<cUF>${cUF}</cUF>` +
    `<cNF>${chave.cNF}</cNF>` +
    `<natOp>Venda ao consumidor</natOp>` +
    `<mod>65</mod>` +
    `<serie>${serieNum}</serie>` +
    `<nNF>${config.numeroNf}</nNF>` +
    `<dhEmi>${dhEmi}</dhEmi>` +
    `<tpNF>1</tpNF>` +
    `<idDest>1</idDest>` +
    `<cMunFG>${config.codigoMunicipio}</cMunFG>` +
    `<tpImp>4</tpImp>` +
    `<tpEmis>1</tpEmis>` +
    `<cDV>${chave.chave.slice(-1)}</cDV>` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<finNFe>1</finNFe>` +
    `<indFinal>1</indFinal>` +
    `<indPres>1</indPres>` +
    `<procEmi>0</procEmi>` +
    `<verProc>1.0.0</verProc>` +
    `</ide>`

  const fone = config.telefone ? `<fone>${config.telefone.replace(/\D/g, '')}</fone>` : ''
  const xCpl = config.complemento ? `<xCpl>${escapeXml(config.complemento)}</xCpl>` : ''

  const emit =
    `<emit>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<xNome>${escapeXml(config.razaoSocial.slice(0, 60))}</xNome>` +
    `<enderEmit>` +
    `<xLgr>${escapeXml(config.logradouro)}</xLgr>` +
    `<nro>${escapeXml(config.numero)}</nro>` +
    `${xCpl}` +
    `<xBairro>${escapeXml(config.bairro)}</xBairro>` +
    `<cMun>${config.codigoMunicipio}</cMun>` +
    `<xMun>${escapeXml(config.municipio)}</xMun>` +
    `<UF>${config.uf}</UF>` +
    `<CEP>${cep}</CEP>` +
    `<cPais>1058</cPais>` +
    `<xPais>Brasil</xPais>` +
    `${fone}` +
    `</enderEmit>` +
    `<IE>${ie}</IE>` +
    `<CRT>${config.crt}</CRT>` +
    `</emit>`

  const total =
    `<total><ICMSTot>` +
    `<vBC>0.00</vBC>` +
    `<vICMS>0.00</vICMS>` +
    `<vICMSDeson>0.00</vICMSDeson>` +
    `<vFCP>0.00</vFCP>` +
    `<vBCST>0.00</vBCST>` +
    `<vST>0.00</vST>` +
    `<vFCPST>0.00</vFCPST>` +
    `<vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${totalProdutos}</vProd>` +
    `<vFrete>0.00</vFrete>` +
    `<vSeg>0.00</vSeg>` +
    `<vDesc>${totalDesc}</vDesc>` +
    `<vII>0.00</vII>` +
    `<vIPI>0.00</vIPI>` +
    `<vIPIDevol>0.00</vIPIDevol>` +
    `<vPIS>0.00</vPIS>` +
    `<vCOFINS>0.00</vCOFINS>` +
    `<vOutro>0.00</vOutro>` +
    `<vNF>${totalNf}</vNF>` +
    `<vTotTrib>0.00</vTotTrib>` +
    `</ICMSTot>` +
    `${buildIbsCbsTotal(ibsCbsAmounts)}` +
    `</total>`

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<infNFe Id="${chave.id}" versao="4.00">` +
    `${ide}${emit}${destXml}${itensXml}${total}` +
    `<transp><modFrete>9</modFrete></transp>` +
    `<pag>${pagXml}<vTroco>${vTroco}</vTroco></pag>` +
    `<infAdic><infCpl>Emitido por @adatechnology/fiscal-provider</infCpl></infAdic>` +
    `</infNFe>` +
    `</NFe>`
  )
}

/**
 * Monta grupo ICMS conforme CRT + CST/CSOSN.
 * CRT 1/2 (Simples) → CSOSN; CRT 3 (Normal) → CST.
 */
function buildIcmsXml(cstOrCsosn: string, crt: string): string {
  const code = (cstOrCsosn || '').replace(/\D/g, '')

  if (crt === '1' || crt === '2') {
    const csosn = code.length === 3 ? code : '102'
    if (csosn === '500') {
      return `<ICMS><ICMSSN500><orig>0</orig><CSOSN>500</CSOSN></ICMSSN500></ICMS>`
    }
    if (csosn === '900') {
      return `<ICMS><ICMSSN900><orig>0</orig><CSOSN>900</CSOSN></ICMSSN900></ICMS>`
    }
    // 101, 102, 103, 300, 400 — isento/não tributado no Simples
    return `<ICMS><ICMSSN102><orig>0</orig><CSOSN>${csosn === '101' || csosn === '103' || csosn === '300' || csosn === '400' ? csosn : '102'}</CSOSN></ICMSSN102></ICMS>`
  }

  // Regime normal (CRT=3)
  const cst = code.padStart(2, '0').slice(0, 2)
  if (cst === '40' || cst === '41' || cst === '50') {
    return `<ICMS><ICMS40><orig>0</orig><CST>${cst}</CST></ICMS40></ICMS>`
  }
  if (cst === '60') {
    return `<ICMS><ICMS60><orig>0</orig><CST>60</CST><vBCSTRet>0.00</vBCSTRet><pST>0.0000</pST><vICMSSubstituto>0.00</vICMSSubstituto><vICMSSTRet>0.00</vICMSSTRet></ICMS60></ICMS>`
  }
  // Default tributado integralmente
  return `<ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type { BuildNfceXmlParams }
