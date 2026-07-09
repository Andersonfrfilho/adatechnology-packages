import { XMLParser } from 'fast-xml-parser'
import { FiscalError, FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'
import type { FiscalResult } from '../types'
import { signCteEventoXml } from './SefazXmlSigner'
import type { CertificateData } from './SefazXmlSigner'

const REQUEST_TIMEOUT_MS = 30_000
const CTE_NS = 'http://www.portalfiscal.inf.br/cte'

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
  parseTagValue: false,
})

// ─── Senders ──────────────────────────────────────────────────────────────────

export async function sendCteAutorizacao(params: {
  endpoint: string
  cUF: string
  signedCteXml: string
  loteId: string
  wsdlNamespace: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const fragment = params.signedCteXml.replace(/^<\?xml[^?]*\?>\s*/i, '')
  // Compact: SEFAZ rejects whitespace between tags (cStat 588)
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><cteCabecMsg xmlns="${params.wsdlNamespace}"><cUF>${params.cUF}</cUF><versaoDados>4.00</versaoDados></cteCabecMsg></soap12:Header><soap12:Body><cteDadosMsg xmlns="${params.wsdlNamespace}"><enviCTe versao="4.00" xmlns="${CTE_NS}"><idLote>${params.loteId.padStart(15, '0')}</idLote><indSinc>1</indSinc>${fragment}</enviCTe></cteDadosMsg></soap12:Body></soap12:Envelope>`

  const soapAction = `"${params.wsdlNamespace}/cteRecepcaoLote"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
        'SOAPAction': soapAction,
      },
      body: soapBody,
    },
    params.certData,
  )

  const responseText = await response.text()
  if (!response.ok) {
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `SEFAZ CT-e retornou HTTP ${response.status}`,
      rawResponse: responseText,
    }
  }

  return parseCteAutorizacaoResponse(responseText)
}

export async function sendCteStatusServico(params: {
  endpoint: string
  cUF: string
  wsdlNamespace: string
  tpAmb: string
  certData: CertificateData
}): Promise<{ ok: boolean; message: string }> {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><cteCabecMsg xmlns="${params.wsdlNamespace}"><cUF>${params.cUF}</cUF><versaoDados>4.00</versaoDados></cteCabecMsg></soap12:Header><soap12:Body><cteDadosMsg xmlns="${params.wsdlNamespace}"><consStatServCte versao="4.00" xmlns="${CTE_NS}"><tpAmb>${params.tpAmb}</tpAmb><xServ>STATUS</xServ></consStatServCte></cteDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${params.wsdlNamespace}/cteStatusServicoCT"`

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
          'SOAPAction': soapAction,
        },
        body: soapBody,
      },
      params.certData,
    )
    const text = await response.text()
    return parseCteStatusResponse(text)
  } catch {
    return { ok: false, message: 'SEFAZ CT-e não respondeu ao status' }
  }
}

export async function sendCteCancelamento(params: {
  endpoint: string
  cUF: string
  chaveAcesso: string
  protocolo: string
  justificativa: string
  cnpj: string
  dhEvento: string
  wsdlNamespace: string
  tpAmb: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const id = `ID110111${params.chaveAcesso}01`
  // Compact: SEFAZ rejects whitespace between tags (cStat 588)
  const eventoXml = `<eventoCTe versao="3.00" xmlns="${CTE_NS}"><infEvento Id="${id}"><cOrgao>${params.cUF}</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${params.cnpj.replace(/\D/g, '')}</CNPJ><chCTe>${params.chaveAcesso}</chCTe><dhEvento>${params.dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><detEvento versao="3.00"><descEvento>Cancelamento</descEvento><nProt>${params.protocolo}</nProt><xJust>${params.justificativa}</xJust></detEvento></infEvento></eventoCTe>`

  const { signedXml } = signCteEventoXml(eventoXml, params.certData)
  const fragment = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><cteCabecMsg xmlns="${params.wsdlNamespace}"><cUF>${params.cUF}</cUF><versaoDados>3.00</versaoDados></cteCabecMsg></soap12:Header><soap12:Body><cteDadosMsg xmlns="${params.wsdlNamespace}">${fragment}</cteDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${params.wsdlNamespace}/cteRecepcaoEvento"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': soapAction,
      },
      body: soapBody,
    },
    params.certData,
  )

  const text = await response.text()
  return parseCteEventoResponse(text)
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCteAutorizacaoResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const resultMsg = body?.cteResultMsg ?? body?.nfeResultMsg
    const retEnvi = resultMsg?.retEnviCTe ?? resultMsg?.retEnviNFe

    const cStat = String(retEnvi?.cStat ?? retEnvi?.infRec?.cStat ?? '')
    const xMotivo = String(retEnvi?.xMotivo ?? '')

    if (cStat === '104') {
      const prot = retEnvi?.protCTe?.infProt ?? retEnvi?.protNFe?.infProt
      const cStatCte = String(prot?.cStat ?? '')
      const xMotivoCte = String(prot?.xMotivo ?? '')
      if (cStatCte === '100' || cStatCte === '150') {
        return {
          success: true,
          chaveAcesso: String(prot?.chCTe ?? prot?.chNFe ?? ''),
          protocolo: String(prot?.nProt ?? ''),
          rawResponse: retEnvi,
        }
      }
      return {
        success: false,
        errorCode: cStatCte,
        errorMessage: xMotivoCte || `SEFAZ CT-e rejeitou: ${cStatCte}`,
        rawResponse: retEnvi,
      }
    }

    return {
      success: false,
      errorCode: cStat || 'SEFAZ_UNKNOWN',
      errorMessage: xMotivo || `SEFAZ CT-e retornou cStat ${cStat}`,
      rawResponse: retEnvi ?? soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'PARSE_ERROR',
      errorMessage: `Erro ao interpretar resposta CT-e: ${error instanceof Error ? error.message : 'desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

function parseCteStatusResponse(soapXml: string): { ok: boolean; message: string } {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retStatus = body?.cteResultMsg?.retConsStatServCte ?? body?.cteResultMsg?.retConsStatServ
    const cStat = String(retStatus?.cStat ?? '')
    const xMotivo = String(retStatus?.xMotivo ?? '')
    if (cStat === '107') return { ok: true, message: xMotivo || 'Serviço CT-e em operação' }
    return { ok: false, message: `SEFAZ CT-e fora do ar [${cStat}]: ${xMotivo}` }
  } catch {
    return { ok: false, message: 'Falha ao interpretar status CT-e' }
  }
}

function parseCteEventoResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const resultMsg = body?.cteResultMsg ?? body?.nfeResultMsg
    const retEvento = resultMsg?.retEventoCTe ?? resultMsg?.retEnvEvento
    const infEvento = retEvento?.retEvento?.infEvento ?? retEvento?.retEvento?.infEvento

    const cStat = String(infEvento?.cStat ?? retEvento?.cStat ?? '')
    const xMotivo = String(infEvento?.xMotivo ?? retEvento?.xMotivo ?? '')

    if (cStat === '135') {
      return { success: true, protocolo: String(infEvento?.nProt ?? ''), rawResponse: retEvento }
    }
    return {
      success: false,
      errorCode: cStat || 'EVENTO_PARSE_ERROR',
      errorMessage: xMotivo || `Cancelamento CT-e rejeitado: cStat ${cStat}`,
      rawResponse: retEvento ?? soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'EVENTO_PARSE_ERROR',
      errorMessage: `Falha ao interpretar resposta de evento CT-e: ${error instanceof Error ? error.message : 'desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  certData: CertificateData,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const tlsOptions = {
    tls: {
      cert: certData.certificatePem,
      key: certData.privateKeyPem,
      rejectUnauthorized: false,
    },
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal, ...tlsOptions })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FiscalTimeoutError('SEFAZ CT-e')
    }
    throw new FiscalConnectionError('SEFAZ CT-e', error instanceof Error ? error.message : 'desconhecido')
  } finally {
    clearTimeout(timer)
  }
}
