import { XMLParser } from 'fast-xml-parser'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'
import type { FiscalResult } from '../types'
import { signCteEventoXml } from './SefazXmlSigner'
import type { CertificateData } from './SefazXmlSigner'
import { CTE_WS_NS } from './CteConstants'

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
  /** CT-e 4.00 usa sempre 'sincrono' (CTeRecepcaoSincV4) */
  modoAutorizacao: 'sincrono' | 'assincrono'
  certData: CertificateData
}): Promise<FiscalResult> {
  const ns = params.modoAutorizacao === 'sincrono' ? CTE_WS_NS.sincrona : CTE_WS_NS.autorizacao
  const fragment = params.signedCteXml.replace(/^<\?xml[^?]*\?>\s*/i, '')

  // CT-e 4.00 CTeRecepcaoSincV4: sem cteCabecMsg, sem enviCTe wrapper — CT-e direto no cteDadosMsg
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><cteDadosMsg xmlns="${ns}">${fragment}</cteDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${ns}/cteRecepcao"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
        SOAPAction: soapAction,
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
      errorMessage: `SEFAZ CT-e retornou HTTP ${response.status}: ${responseText.slice(0, 200)}`,
      rawResponse: responseText,
    }
  }

  return parseCteAutorizacaoResponse(responseText)
}

export async function sendCteStatusServico(params: {
  endpoint: string
  cUF: string
  tpAmb: string
  certData: CertificateData
}): Promise<{ ok: boolean; message: string }> {
  const ns = CTE_WS_NS.status
  // CT-e 4.00: consStatServCTe com ordem cUF antes de xServ
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><cteDadosMsg xmlns="${ns}"><consStatServCTe versao="4.00" xmlns="${CTE_NS}"><tpAmb>${params.tpAmb}</tpAmb><cUF>${params.cUF}</cUF><xServ>STATUS</xServ></consStatServCTe></cteDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${ns}/cteStatusServicoCT"`

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action=${soapAction}`,
          SOAPAction: soapAction,
        },
        body: soapBody,
      },
      params.certData,
    )
    const text = await response.text()
    return parseCteStatusResponse(text)
  } catch (error) {
    return {
      ok: false,
      message: `SEFAZ CT-e não respondeu ao status: ${error instanceof Error ? error.message : 'desconhecido'}`,
    }
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
  tpAmb: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const ns = CTE_WS_NS.evento
  const id = `ID110111${params.chaveAcesso}01`
  const eventoXml = `<eventoCTe versao="3.00" xmlns="${CTE_NS}"><infEvento Id="${id}"><cOrgao>${params.cUF}</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${params.cnpj.replace(/\D/g, '')}</CNPJ><chCTe>${params.chaveAcesso}</chCTe><dhEvento>${params.dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><detEvento versao="3.00"><descEvento>Cancelamento</descEvento><nProt>${params.protocolo}</nProt><xJust>${params.justificativa}</xJust></detEvento></infEvento></eventoCTe>`

  const { signedXml } = signCteEventoXml(eventoXml, params.certData)
  const fragment = signedXml.replace(/^<\?xml[^?]*\?>\s*/i, '')

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><cteCabecMsg xmlns="${ns}"><cUF>${params.cUF}</cUF><versaoDados>3.00</versaoDados></cteCabecMsg></soap12:Header><soap12:Body><cteDadosMsg xmlns="${ns}">${fragment}</cteDadosMsg></soap12:Body></soap12:Envelope>`
  const soapAction = `"${ns}/cteRecepcaoEventoCT"`

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: soapAction,
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

    // CT-e 4.00 sync: cteRecepcaoResult > retCTeSinc
    // CT-e 3.x legacy: cteResultMsg > retEnviCTe
    const retEnvi = body?.cteRecepcaoResult?.retCTeSinc ?? body?.cteResultMsg?.retEnviCTe ?? body?.cteResultMsg?.retCTe

    const cStat = String(retEnvi?.cStat ?? retEnvi?.infRec?.cStat ?? '')
    const xMotivo = String(retEnvi?.xMotivo ?? '')

    // cStat 100/150 = autorizado (CT-e 4.00 sincrono retorna protCTe diretamente)
    if (cStat === '100' || cStat === '150') {
      const prot = retEnvi?.protCTe?.infProt
      return {
        success: true,
        chaveAcesso: String(prot?.chCTe ?? ''),
        protocolo: String(prot?.nProt ?? ''),
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
    // CT-e 4.00 response: cteStatusServicoCTResult > retConsStatServCTe
    const retStatus =
      body?.cteStatusServicoCTResult?.retConsStatServCTe ??
      body?.cteStatusServicoCTResult?.retConsStatServCte ??
      body?.cteResultMsg?.retConsStatServCTe ??
      body?.cteResultMsg?.retConsStatServCte
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

async function fetchWithTimeout(url: string, options: RequestInit, certData: CertificateData): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      // @ts-expect-error — Bun TLS extension para mTLS
      tls: {
        cert: certData.certificatePem,
        key: certData.privateKeyPem,
        rejectUnauthorized: false,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FiscalTimeoutError('SEFAZ CT-e')
    }
    throw new FiscalConnectionError('SEFAZ CT-e', error instanceof Error ? error.message : 'desconhecido')
  } finally {
    clearTimeout(timer)
  }
}
