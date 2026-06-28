import { XMLParser } from 'fast-xml-parser'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'
import type { FiscalResult } from '../types'
import { SEFAZ_RETRYABLE_CODES } from './SefazConstants'
import type { CertificateData } from './SefazXmlSigner'

const REQUEST_TIMEOUT_MS = 30_000

type SoapSendParams = {
  readonly endpoint: string
  readonly cUF: string
  readonly signedNfeXml: string
  readonly loteId: string
  readonly wsdlNamespace: string
  readonly certData: CertificateData
}

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
})

export async function sendNfceAutorizacao(params: SoapSendParams): Promise<FiscalResult> {
  const soapBody = buildSoapEnvelope(params)
  const soapAction = `"${params.wsdlNamespace}/nfceAutorizacaoNF"`

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
      errorMessage: `SEFAZ retornou HTTP ${response.status}`,
      rawResponse: responseText,
    }
  }

  return parseSefazResponse(responseText)
}

export async function sendNfceCancelamento(params: {
  endpoint: string
  cUF: string
  chaveAcesso: string
  justificativa: string
  cnpj: string
  dhEvento: string
  nSeqEvento: string
  certData: CertificateData
}): Promise<FiscalResult> {
  const eventoXml = buildCancelamentoEventoXml(params)
  const soapBody = buildEventoSoapEnvelope({ cUF: params.cUF, eventoXml })

  const response = await fetchWithTimeout(
    params.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NfceRecepcaoEvento4/nfceRecepcaoEvento"',
      },
      body: soapBody,
    },
    params.certData,
  )

  const responseText = await response.text()
  return parseSefazEventoResponse(responseText)
}

export async function sendStatusServico(params: {
  endpoint: string
  cUF: string
  certData: CertificateData
}): Promise<{ ok: boolean; message: string }> {
  const soapBody = buildStatusServicoSoap(params.cUF)

  try {
    const response = await fetchWithTimeout(
      params.endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
        body: soapBody,
      },
      params.certData,
    )
    const responseText = await response.text()
    return parseStatusResponse(responseText)
  } catch {
    return { ok: false, message: 'SEFAZ não respondeu ao status' }
  }
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildSoapEnvelope({ cUF, signedNfeXml, loteId, wsdlNamespace }: SoapSendParams): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="${wsdlNamespace}">
      <cUF>${cUF}</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="${wsdlNamespace}">
      <enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>${loteId.padStart(15, '0')}</idLote>
        <indSinc>1</indSinc>
        ${signedNfeXml}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`
}

function buildEventoSoapEnvelope({ cUF, eventoXml }: { cUF: string; eventoXml: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <cUF>${cUF}</cUF>
      <versaoDados>1.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      ${eventoXml}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`
}

function buildCancelamentoEventoXml(params: {
  chaveAcesso: string
  justificativa: string
  cnpj: string
  dhEvento: string
  nSeqEvento: string
}): string {
  const id = `ID110111${params.chaveAcesso}${params.nSeqEvento.padStart(2, '0')}`
  return `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="${id}">
      <cOrgao>91</cOrgao>
      <tpAmb>2</tpAmb>
      <CNPJ>${params.cnpj.replace(/\D/g, '')}</CNPJ>
      <chNFe>${params.chaveAcesso}</chNFe>
      <dhEvento>${params.dhEvento}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>${params.nSeqEvento}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt></nProt>
        <xJust>${params.justificativa}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`
}

function buildStatusServicoSoap(cUF: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <cUF>${cUF}</cUF><versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <tpAmb>2</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseSefazResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const resultMsg = body?.nfeResultMsg ?? body?.['nfeResultMsg']
    const retEnvi = resultMsg?.retEnviNFe ?? resultMsg?.retNFe

    const cStat = String(retEnvi?.cStat ?? retEnvi?.infRec?.cStat ?? '')
    const xMotivo = String(retEnvi?.xMotivo ?? '')

    if (cStat === '104') {
      const prot = retEnvi?.protNFe?.infProt
      const cStatNfe = String(prot?.cStat ?? '')
      const xMotivoNfe = String(prot?.xMotivo ?? '')

      if (cStatNfe === '100' || cStatNfe === '150') {
        return {
          success: true,
          chaveAcesso: String(prot?.chNFe ?? ''),
          protocolo: String(prot?.nProt ?? ''),
          rawResponse: retEnvi,
        }
      }

      return {
        success: false,
        errorCode: cStatNfe,
        errorMessage: xMotivoNfe || `SEFAZ rejeitou: ${cStatNfe}`,
        rawResponse: retEnvi,
      }
    }

    if (SEFAZ_RETRYABLE_CODES.has(cStat)) {
      throw new Error(`SEFAZ_${cStat}: ${xMotivo}`)
    }

    return {
      success: false,
      errorCode: cStat,
      errorMessage: xMotivo || `SEFAZ retornou cStat ${cStat}`,
      rawResponse: retEnvi ?? soapXml,
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SEFAZ_')) throw error
    return {
      success: false,
      errorCode: 'PARSE_ERROR',
      errorMessage: 'Não foi possível interpretar a resposta da SEFAZ',
      rawResponse: soapXml,
    }
  }
}

function parseSefazEventoResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retEvento = body?.nfeResultMsg?.retEnvEvento ?? body?.nfeResultMsg?.retEnvEvento
    const infEvento = retEvento?.retEvento?.infEvento

    const cStat = String(infEvento?.cStat ?? retEvento?.cStat ?? '')
    const xMotivo = String(infEvento?.xMotivo ?? retEvento?.xMotivo ?? '')

    if (cStat === '135') {
      return { success: true, protocolo: String(infEvento?.nProt ?? ''), rawResponse: retEvento }
    }

    return {
      success: false,
      errorCode: cStat,
      errorMessage: xMotivo || `Cancelamento rejeitado: ${cStat}`,
      rawResponse: retEvento ?? soapXml,
    }
  } catch {
    return {
      success: false,
      errorCode: 'PARSE_ERROR',
      errorMessage: 'Falha ao interpretar resposta do cancelamento',
      rawResponse: soapXml,
    }
  }
}

function parseStatusResponse(soapXml: string): { ok: boolean; message: string } {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retStatus = body?.nfeResultMsg?.retConsStatServ
    const cStat = String(retStatus?.cStat ?? '')
    const xMotivo = String(retStatus?.xMotivo ?? '')

    return { ok: cStat === '107', message: xMotivo || `cStat ${cStat}` }
  } catch {
    return { ok: false, message: 'Falha ao interpretar status' }
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

  // SEFAZ exige mTLS: certificado A1 apresentado no handshake TLS.
  // ICP-Brasil não está no bundle padrão — rejectUnauthorized: false aceita o cert do servidor.
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
      throw new FiscalTimeoutError('SEFAZ')
    }
    throw new FiscalConnectionError(
      'SEFAZ',
      error instanceof Error ? error.message : 'erro de rede desconhecido'
    )
  } finally {
    clearTimeout(timer)
  }
}
