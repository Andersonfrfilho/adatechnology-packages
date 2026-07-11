import type { EmitFiscalParams, NfeConfig, NfeData, NfeDestinatario } from '../types'
import type { ChaveAcesso } from './SefazChave'
import { UF_IBGE_CODES } from './SefazConstants'
import { toNfcePaymentCode } from '../utils/mapPaymentMethod'
import { formatDhEmi } from './SefazDateTime'

type BuildNfeXmlParams = {
  readonly params: EmitFiscalParams
  readonly config: NfeConfig
  readonly nfeData: NfeData
  readonly chave: ChaveAcesso
  readonly dataEmissao: Date
}

export function buildNfeXml({ params, config, nfeData, chave, dataEmissao }: BuildNfeXmlParams): string {
  const tpAmb = config.environment === 'producao' ? '1' : '2'
  const cUF = UF_IBGE_CODES[config.uf] ?? '00'
  const dhEmi = formatDhEmi(dataEmissao)
  const dest = nfeData.destinatario
  const natOp = nfeData.naturezaOperacao ?? 'Venda de mercadoria'
  const finNFe = nfeData.finalidade ?? '1'
  const idDest = nfeData.destinoOperacao ?? computeIdDest(config.uf, dest.uf)
  const indFinal = nfeData.indFinal ?? '1'

  const totalProdutos = params.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)
  const totalNf = params.totalAmount.toFixed(2)
  const totalDesc = params.discountAmount.toFixed(2)
  const serieNum = String(parseInt(config.serie, 10) || 1)

  // SEFAZ exige este xNome fixo em homologação (cStat 598 caso contrário)
  const destEffective =
    tpAmb === '2'
      ? { ...nfeData.destinatario, xNome: 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' }
      : nfeData.destinatario

  const itensXml = params.items
    .map(
      (item, index) =>
        `<det nItem="${index + 1}"><prod><cProd>${escapeXml(item.codigo)}</cProd><cEAN>SEM GTIN</cEAN><xProd>${escapeXml(item.descricao)}</xProd><NCM>${item.ncm}</NCM><CFOP>${item.cfop}</CFOP><uCom>${item.unidade}</uCom><qCom>${item.quantidade.toFixed(4)}</qCom><vUnCom>${item.valorUnitario.toFixed(10)}</vUnCom><vProd>${item.valorTotal.toFixed(2)}</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>${item.unidade}</uTrib><qTrib>${item.quantidade.toFixed(4)}</qTrib><vUnTrib>${item.valorUnitario.toFixed(10)}</vUnTrib><indTot>1</indTot></prod><imposto><vTotTrib>0.00</vTotTrib>${buildIcmsXml(item.cst, config.crt)}<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det>`,
    )
    .join('')

  const pagXml = params.payments
    .map(
      (payment) =>
        `<detPag><tPag>${toNfcePaymentCode(payment.method)}</tPag><vPag>${payment.amount.toFixed(2)}</vPag></detPag>`,
    )
    .join('')

  const descXml = `<vDesc>${totalDesc}</vDesc>`

  const infAdicXml = nfeData.informacoesAdicionais
    ? `<infAdic><infCpl>${escapeXml(nfeData.informacoesAdicionais)}</infCpl></infAdic>`
    : '<infAdic><infCpl>Emitido por sistema automatizado.</infCpl></infAdic>'

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="${chave.id}" versao="4.00"><ide><cUF>${cUF}</cUF><cNF>${chave.cNF}</cNF><natOp>${escapeXml(natOp)}</natOp><mod>55</mod><serie>${serieNum}</serie><nNF>${config.numeroNf}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>${idDest}</idDest><cMunFG>${config.codigoMunicipio}</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${chave.chave.slice(-1)}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>${finNFe}</finNFe><indFinal>${indFinal}</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>1.0.0</verProc></ide>${buildEmitXml(config)}${buildDestXml(destEffective)}${itensXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${totalProdutos}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg>${descXml}<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${totalNf}</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag>${pagXml}</pag>${infAdicXml}</infNFe></NFe>`
}

function buildEmitXml(config: NfeConfig): string {
  const xCpl = config.complemento ? `<xCpl>${escapeXml(config.complemento)}</xCpl>` : ''
  const fone = config.telefone ? `<fone>${config.telefone.replace(/\D/g, '')}</fone>` : ''
  const ie = config.inscricaoEstadual.replace(/\D/g, '') || 'ISENTO'
  return `<emit><CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ><xNome>${escapeXml(config.razaoSocial)}</xNome><enderEmit><xLgr>${escapeXml(config.logradouro)}</xLgr><nro>${escapeXml(config.numero)}</nro>${xCpl}<xBairro>${escapeXml(config.bairro)}</xBairro><cMun>${config.codigoMunicipio}</cMun><xMun>${escapeXml(config.municipio)}</xMun><UF>${config.uf}</UF><CEP>${config.cep.replace(/\D/g, '')}</CEP><cPais>1058</cPais><xPais>Brasil</xPais>${fone}</enderEmit><IE>${ie}</IE><CRT>${config.crt}</CRT></emit>`
}

function buildDestXml(dest: NfeDestinatario): string {
  const docXml = dest.cnpj
    ? `<CNPJ>${dest.cnpj.replace(/\D/g, '')}</CNPJ>`
    : dest.cpf
      ? `<CPF>${dest.cpf.replace(/\D/g, '')}</CPF>`
      : ''
  const xCpl = dest.complemento ? `<xCpl>${escapeXml(dest.complemento)}</xCpl>` : ''
  const fone = dest.telefone ? `<fone>${dest.telefone.replace(/\D/g, '')}</fone>` : ''
  const ieXml =
    dest.indicadorIe === '1' && dest.inscricaoEstadual ? `<IE>${dest.inscricaoEstadual.replace(/\D/g, '')}</IE>` : ''
  const emailXml = dest.email ? `<email>${escapeXml(dest.email)}</email>` : ''

  return `<dest>${docXml}<xNome>${escapeXml(dest.xNome)}</xNome><enderDest><xLgr>${escapeXml(dest.logradouro)}</xLgr><nro>${escapeXml(dest.numero)}</nro>${xCpl}<xBairro>${escapeXml(dest.bairro)}</xBairro><cMun>${dest.codigoMunicipio}</cMun><xMun>${escapeXml(dest.municipio)}</xMun><UF>${dest.uf}</UF><CEP>${dest.cep.replace(/\D/g, '')}</CEP><cPais>1058</cPais><xPais>Brasil</xPais>${fone}</enderDest><indIEDest>${dest.indicadorIe}</indIEDest>${ieXml}${emailXml}</dest>`
}

function buildIcmsXml(cst: string, crt: string): string {
  if (crt === '1') {
    return `<ICMS><ICMSSN500><orig>0</orig><CSOSN>500</CSOSN></ICMSSN500></ICMS>`
  }
  return `<ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>`
}

function computeIdDest(emitUf: string, destUf: string): '1' | '2' | '3' {
  if (!destUf || destUf === emitUf) return '1'
  return '2'
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type { BuildNfeXmlParams }
