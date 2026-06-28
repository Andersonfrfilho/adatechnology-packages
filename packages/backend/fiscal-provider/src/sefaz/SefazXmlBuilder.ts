import type { EmitFiscalParams, NfceConfig } from '../types'
import type { ChaveAcesso } from './SefazChave'
import { UF_IBGE_CODES } from './SefazConstants'
import { toNfcePaymentCode } from '../utils/mapPaymentMethod'

type BuildNfceXmlParams = {
  readonly params: EmitFiscalParams
  readonly config: NfceConfig
  readonly chave: ChaveAcesso
  readonly dataEmissao: Date
}

export function buildNfceXml({ params, config, chave, dataEmissao }: BuildNfceXmlParams): string {
  const tpAmb = config.environment === 'producao' ? '1' : '2'
  const cUF = UF_IBGE_CODES[config.uf] ?? '00'
  const dhEmi = formatDateTime(dataEmissao)
  const totalProdutos = params.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)
  const totalNf = params.totalAmount.toFixed(2)
  const totalDesc = params.discountAmount.toFixed(2)

  const itenXml = params.items.map((item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${escapeXml(item.codigo)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${escapeXml(item.descricao)}</xProd>
        <NCM>${item.ncm}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unidade}</uCom>
        <qCom>${item.quantidade.toFixed(4)}</qCom>
        <vUnCom>${item.valorUnitario.toFixed(10)}</vUnCom>
        <vProd>${item.valorTotal.toFixed(2)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${item.unidade}</uTrib>
        <qTrib>${item.quantidade.toFixed(4)}</qTrib>
        <vUnTrib>${item.valorUnitario.toFixed(10)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>0.00</vTotTrib>
        ${buildIcmsXml(item.cst, config.crt)}
        <PIS><PISNT><CST>07</CST></PISNT></PIS>
        <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
      </imposto>
    </det>`).join('')

  const pagXml = params.payments.map(payment => `
      <detPag>
        <tPag>${toNfcePaymentCode(payment.method)}</tPag>
        <vPag>${payment.amount.toFixed(2)}</vPag>
      </detPag>`).join('')

  const destXml = params.customerCpf
    ? `<dest><CPF>${params.customerCpf.replace(/\D/g, '')}</CPF><indIEDest>9</indIEDest></dest>`
    : ''

  const descXml = params.discountAmount > 0
    ? `<vDesc>${totalDesc}</vDesc>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="${chave.id}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${chave.cNF}</cNF>
      <natOp>Venda ao consumidor</natOp>
      <mod>65</mod>
      <serie>${config.serie.padStart(3, '0')}</serie>
      <nNF>${config.numeroNf}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${config.codigoMunicipio}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.chave.slice(-1)}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <indIntermed>0</indIntermed>
      <procEmi>0</procEmi>
      <verProc>1.0.0</verProc>
    </ide>
    <emit>
      <CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${escapeXml(config.razaoSocial)}</xNome>
      <enderEmit>
        <xLgr>${escapeXml(config.logradouro)}</xLgr>
        <nro>${escapeXml(config.numero)}</nro>
        ${config.complemento ? `<xCpl>${escapeXml(config.complemento)}</xCpl>` : ''}
        <xBairro>${escapeXml(config.bairro)}</xBairro>
        <cMun>${config.codigoMunicipio}</cMun>
        <xMun>${escapeXml(config.municipio)}</xMun>
        <UF>${config.uf}</UF>
        <CEP>${config.cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${config.telefone ? `<fone>${config.telefone.replace(/\D/g, '')}</fone>` : ''}
      </enderEmit>
      <CRT>${config.crt}</CRT>
    </emit>
    ${destXml}
    ${itenXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${totalProdutos}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        ${descXml}
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${totalNf}</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag>
      ${pagXml}
    </pag>
    <infAdic>
      <infCpl>Emitido por sistema automatizado.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`
}

function buildIcmsXml(cst: string, crt: string): string {
  if (crt === '1') {
    return `<ICMS><ICMSSN500><orig>0</orig><CSOSN>500</CSOSN></ICMSSN500></ICMS>`
  }
  return `<ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.00</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS>`
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`
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
