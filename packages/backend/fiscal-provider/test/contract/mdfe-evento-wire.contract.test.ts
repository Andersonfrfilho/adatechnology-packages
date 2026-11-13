/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import * as forge from 'node-forge'

import { FiscalEnvironment, type MdfeConfig, SefazMdfeProvider } from '../../src/index'

const CERTIFICATE_CNPJ = '11222333000181'
const CERTIFICATE_PASSWORD = 'fixture-password'
const MOCK_ACCESS_KEY = '35260711222333000181580010000000011000000018'
const MOCK_PROTOCOL = '135260000000001'
const DEFAULT_JUSTIFICATIVA = 'Cancelamento por erro de rota no manifesto emitido'
const SVRS_HOMOLOGACAO_EVENTO = 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx'
const MDFE_EVENTO_NS = 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento'
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('MDF-e encerramento 110112 — formato do evento', () => {
  test('monta o Id como ID + tpEvento + chave + nSeqEvento com dois dígitos', async () => {
    const { requestBody } = await closeAndCapture()

    expect(requestBody.includes(`<infEvento Id="ID110112${MOCK_ACCESS_KEY}01">`)).toBe(true)
  })

  test('usa versaoEvento no detEvento — o MDF-e não usa o versao do CT-e', async () => {
    const { requestBody } = await closeAndCapture()

    expect(requestBody.includes('<detEvento versaoEvento="3.00">')).toBe(true)
    expect(requestBody.includes('<detEvento versao="3.00">')).toBe(false)
  })

  test('mantém a sequência de infEvento exigida pelo schema', async () => {
    const { requestBody } = await closeAndCapture()

    const infEvento = requestBody.match(/<infEvento [^>]*>([\s\S]*?)<\/infEvento>/)?.[1] ?? ''
    const order = [
      '<cOrgao>',
      '<tpAmb>',
      '<CNPJ>',
      '<chMDFe>',
      '<dhEvento>',
      '<tpEvento>',
      '<nSeqEvento>',
      '<detEvento ',
    ]
    const positions = order.map((tag) => infEvento.indexOf(tag))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((first, second) => first - second))
  })

  test('escreve o grupo evEncMDFe com nProt, dtEnc, cUF e cMun nessa ordem', async () => {
    const { requestBody } = await closeAndCapture()

    expect(
      requestBody.includes(
        '<evEncMDFe><descEvento>Encerramento</descEvento>' +
          `<nProt>${MOCK_PROTOCOL}</nProt><dtEnc>2026-07-28</dtEnc>` +
          '<cUF>33</cUF><cMun>3304557</cMun></evEncMDFe>',
      ),
    ).toBe(true)
  })

  // cOrgao é a UF do emitente; cUF/cMun do evEncMDFe são o lugar onde a viagem terminou
  test('separa o cOrgao do emitente da UF de encerramento', async () => {
    const { requestBody } = await closeAndCapture()

    expect(requestBody.includes('<cOrgao>35</cOrgao>')).toBe(true)
    expect(requestBody.includes('<tpAmb>2</tpAmb>')).toBe(true)
    expect(requestBody.includes(`<CNPJ>${CERTIFICATE_CNPJ}</CNPJ>`)).toBe(true)
    expect(requestBody.includes(`<chMDFe>${MOCK_ACCESS_KEY}</chMDFe>`)).toBe(true)
    expect(requestBody.includes('<tpEvento>110112</tpEvento>')).toBe(true)
    expect(requestBody.includes('<nSeqEvento>1</nSeqEvento>')).toBe(true)
  })

  test('emite indEncPorTerceiro apenas quando o encerramento é por terceiro', async () => {
    const semTerceiro = await closeAndCapture()
    expect(semTerceiro.requestBody.includes('<indEncPorTerceiro>')).toBe(false)

    const comTerceiro = await closeAndCapture({ encerradoPorTerceiro: true })
    expect(comTerceiro.requestBody.includes('<cMun>3304557</cMun><indEncPorTerceiro>1</indEncPorTerceiro>')).toBe(true)
  })

  test('assina o infEvento e coloca a Signature depois dele', async () => {
    const { requestBody } = await closeAndCapture()

    expect(requestBody.includes(`<Reference URI="#ID110112${MOCK_ACCESS_KEY}01">`)).toBe(true)
    expect(requestBody.includes('<SignatureValue>')).toBe(true)
    expect(requestBody.indexOf('<Signature')).toBeGreaterThan(requestBody.indexOf('</infEvento>'))
    expect(requestBody.indexOf('<Signature')).toBeLessThan(requestBody.indexOf('</eventoMDFe>'))
  })
})

describe('MDFeRecepcaoEvento wire format', () => {
  test('envia o eventoMDFe cru dentro de mdfeDadosMsg — sem GZip', async () => {
    const { requestBody } = await closeAndCapture()

    const payload = requestBody.match(/<mdfeDadosMsg[^>]*>([\s\S]*)<\/mdfeDadosMsg>/)?.[1] ?? ''
    expect(payload.startsWith('<eventoMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">')).toBe(true)
    expect(payload.includes('<?xml')).toBe(false)
  })

  test('endereça o MDFeRecepcaoEvento da SVRS com a SOAPAction correta', async () => {
    const { requestUrl, soapAction, namespace } = await closeAndCapture()

    expect(requestUrl).toBe(SVRS_HOMOLOGACAO_EVENTO)
    expect(namespace).toBe(MDFE_EVENTO_NS)
    expect(soapAction).toBe(`"${MDFE_EVENTO_NS}/mdfeRecepcaoEvento"`)
  })

  // sped-mdfe não monta SOAP Header em nenhum serviço do MDF-e — só o sped-nfe monta
  test('não envia SOAP Header', async () => {
    const { requestBody } = await closeAndCapture()

    expect(requestBody.includes('mdfeCabecMsg')).toBe(false)
    expect(requestBody.includes('<soap12:Header>')).toBe(false)
  })

  test('nunca vaza material do certificado no envelope', async () => {
    const { requestBody, pfxBase64 } = await closeAndCapture()

    expect(requestBody.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(requestBody.includes(pfxBase64)).toBe(false)
  })
})

describe('MDFeRecepcaoEvento — leitura da resposta', () => {
  test('aceita o cStat 135 e devolve o procEventoMDFe', async () => {
    const { result, requestBody } = await closeAndCapture()

    expect(result.success).toBe(true)
    expect(result.protocolo).toBe('135260000000002')
    expect(result.chaveAcesso).toBe(MOCK_ACCESS_KEY)

    const xmlEvento = result.xmlEvento ?? ''
    expect(xmlEvento.includes('<procEventoMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">')).toBe(true)
    expect(xmlEvento.includes('<eventoMDFe versao="3.00"')).toBe(true)
    expect(xmlEvento.includes('<retEventoMDFe')).toBe(true)
    expect(xmlEvento.includes('</procEventoMDFe>')).toBe(true)

    const signedEvento = requestBody.match(/<eventoMDFe[\s>][\s\S]*?<\/eventoMDFe>/)?.[0] ?? ''
    expect(xmlEvento.includes(signedEvento)).toBe(true)
  })

  test('devolve o cStat e o xMotivo quando a SEFAZ recusa o encerramento', async () => {
    const { result } = await closeAndCapture({ response: buildRejectedEventoResponse() })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('573')
    expect(result.errorMessage).toContain('Duplicidade de evento')
    expect(result.xmlEvento).toBeUndefined()
  })
})

describe('MDF-e encerramento — validação antes da rede', () => {
  test('recusa chave que não tenha 44 dígitos sem chamar a SEFAZ', async () => {
    const { result, called } = await closeAndCapture({ chaveAcesso: '123' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_CHAVE')
    expect(called).toBe(false)
  })

  test('recusa encerramento sem protocolo de autorização', async () => {
    const { result, called } = await closeAndCapture({ protocolo: '' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('MISSING_PROTOCOLO')
    expect(called).toBe(false)
  })

  test('recusa município de encerramento fora do formato IBGE', async () => {
    const { result, called } = await closeAndCapture({ codigoMunicipioEncerramento: '3304' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_MUNICIPIO_ENCERRAMENTO')
    expect(called).toBe(false)
  })

  test('recusa UF de encerramento desconhecida', async () => {
    const { result, called } = await closeAndCapture({ ufEncerramento: 'ZZ' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_UF_ENCERRAMENTO')
    expect(called).toBe(false)
  })

  test('recusa data de encerramento fora de AAAA-MM-DD', async () => {
    const { result, called } = await closeAndCapture({ dataEncerramento: '28/07/2026' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_DATA_ENCERRAMENTO')
    expect(called).toBe(false)
  })
})

describe('MDF-e cancelamento 110111 — formato do evento', () => {
  test('monta o Id com o tpEvento 110111 e o grupo evCancMDFe', async () => {
    const { requestBody } = await cancelAndCapture()

    expect(requestBody.includes(`<infEvento Id="ID110111${MOCK_ACCESS_KEY}01">`)).toBe(true)
    expect(requestBody.includes('<tpEvento>110111</tpEvento>')).toBe(true)
    expect(
      requestBody.includes(
        '<detEvento versaoEvento="3.00"><evCancMDFe><descEvento>Cancelamento</descEvento>' +
          `<nProt>${MOCK_PROTOCOL}</nProt><xJust>${DEFAULT_JUSTIFICATIVA}</xJust></evCancMDFe></detEvento>`,
      ),
    ).toBe(true)
  })

  test('assina o infEvento do cancelamento', async () => {
    const { requestBody } = await cancelAndCapture()

    expect(requestBody.includes(`<Reference URI="#ID110111${MOCK_ACCESS_KEY}01">`)).toBe(true)
    expect(requestBody.indexOf('<Signature')).toBeGreaterThan(requestBody.indexOf('</infEvento>'))
  })

  test('usa o mesmo MDFeRecepcaoEvento do encerramento', async () => {
    const { requestUrl, soapAction } = await cancelAndCapture()

    expect(requestUrl).toBe(SVRS_HOMOLOGACAO_EVENTO)
    expect(soapAction).toBe(`"${MDFE_EVENTO_NS}/mdfeRecepcaoEvento"`)
  })

  test('aceita o cStat 135 e devolve o procEventoMDFe do cancelamento', async () => {
    const { result } = await cancelAndCapture({ response: buildRegisteredEventoResponse('110111') })

    expect(result.success).toBe(true)
    expect(result.protocolo).toBe('135260000000002')
    expect(result.xmlEvento?.includes('<procEventoMDFe versao="3.00"')).toBe(true)
  })

  test('escapa caractere reservado de XML na justificativa', async () => {
    const { requestBody } = await cancelAndCapture({
      justificativa: 'Cancelamento por erro de rota & destino divergente',
    })

    expect(requestBody.includes('<xJust>Cancelamento por erro de rota &amp; destino divergente</xJust>')).toBe(true)
  })
})

describe('MDF-e cancelamento — validação antes da rede', () => {
  test('recusa justificativa com menos de 15 caracteres', async () => {
    const { result, called } = await cancelAndCapture({ justificativa: 'erro' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_JUSTIFICATIVA')
    expect(called).toBe(false)
  })

  test('recusa cancelamento sem protocolo de autorização', async () => {
    const { result, called } = await cancelAndCapture({ protocolo: '' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('MISSING_PROTOCOLO')
    expect(called).toBe(false)
  })

  test('recusa chave que não tenha 44 dígitos', async () => {
    const { result, called } = await cancelAndCapture({ chaveAcesso: '123' })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_CHAVE')
    expect(called).toBe(false)
  })

  test('não devolve mais MDFE_EVENTO_NAO_SUPORTADO', async () => {
    const { result } = await cancelAndCapture()

    expect(result.errorCode).not.toBe('MDFE_EVENTO_NAO_SUPORTADO')
  })
})

type CancelOverrides = {
  readonly chaveAcesso?: string
  readonly protocolo?: string
  readonly justificativa?: string
  readonly response?: string
}

async function cancelAndCapture(overrides: CancelOverrides = {}) {
  const capture = createFetchCapture(overrides.response ?? buildRegisteredEventoResponse('110111'))
  const certificateFixture = createCertificateFixture()
  const config = buildMdfeConfig(certificateFixture.pfxBase64)
  const provider = new SefazMdfeProvider()

  const result = await provider.cancel({
    config,
    chaveAcesso: overrides.chaveAcesso ?? MOCK_ACCESS_KEY,
    protocolo: overrides.protocolo ?? MOCK_PROTOCOL,
    justificativa: overrides.justificativa ?? DEFAULT_JUSTIFICATIVA,
  })

  return { result, ...capture.read() }
}

type CloseOverrides = {
  readonly chaveAcesso?: string
  readonly protocolo?: string
  readonly dataEncerramento?: string
  readonly ufEncerramento?: string
  readonly codigoMunicipioEncerramento?: string
  readonly encerradoPorTerceiro?: boolean
  readonly response?: string
}

function createFetchCapture(response: string) {
  let requestBody = ''
  let requestUrl = ''
  let soapAction = ''
  let called = false

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    called = true
    requestUrl = String(input)
    requestBody = typeof init?.body === 'string' ? init.body : ''
    soapAction = new Headers(init?.headers).get('SOAPAction') ?? ''
    return new Response(response, { status: 200 })
  }

  return {
    read: () => ({
      requestBody,
      requestUrl,
      soapAction,
      called,
      namespace: requestBody.match(/<mdfeDadosMsg xmlns="([^"]+)"/)?.[1] ?? '',
    }),
  }
}

async function closeAndCapture(overrides: CloseOverrides = {}) {
  const capture = createFetchCapture(overrides.response ?? buildRegisteredEventoResponse())
  const certificateFixture = createCertificateFixture()

  const config = buildMdfeConfig(certificateFixture.pfxBase64)
  const provider = new SefazMdfeProvider()
  const result = await provider.close({
    config,
    chaveAcesso: overrides.chaveAcesso ?? MOCK_ACCESS_KEY,
    protocolo: overrides.protocolo ?? MOCK_PROTOCOL,
    dataEncerramento: overrides.dataEncerramento ?? '2026-07-28',
    ufEncerramento: overrides.ufEncerramento ?? 'RJ',
    codigoMunicipioEncerramento: overrides.codigoMunicipioEncerramento ?? '3304557',
    ...(overrides.encerradoPorTerceiro === undefined ? {} : { encerradoPorTerceiro: overrides.encerradoPorTerceiro }),
  })

  return { result, ...capture.read(), pfxBase64: certificateFixture.pfxBase64 }
}

function createCertificateFixture(): { readonly pfxBase64: string } {
  const keyPair = forge.pki.rsa.generateKeyPair(2048)
  const certificate = forge.pki.createCertificate()
  const now = Date.now()

  certificate.publicKey = keyPair.publicKey
  certificate.serialNumber = '01'
  certificate.validity.notBefore = new Date(now - 24 * 60 * 60 * 1000)
  certificate.validity.notAfter = new Date(now + 365 * 24 * 60 * 60 * 1000)
  certificate.setSubject([{ name: 'commonName', value: `TRANSPORTADORA TESTE:${CERTIFICATE_CNPJ}` }])
  certificate.setIssuer([{ name: 'commonName', value: 'AC TESTE ICP-Brasil' }])
  certificate.setExtensions([
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true },
    { name: 'extKeyUsage', clientAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'fiscal-contract.test' }] },
  ])
  certificate.sign(keyPair.privateKey, forge.md.sha256.create())

  const pkcs12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, [certificate], CERTIFICATE_PASSWORD, {
    algorithm: '3des',
  })

  return { pfxBase64: forge.util.encode64(forge.asn1.toDer(pkcs12).getBytes()) }
}

function buildMdfeConfig(certificadoBase64: string): MdfeConfig {
  return {
    model: 'mdfe',
    environment: FiscalEnvironment.HOMOLOGACAO,
    cnpj: CERTIFICATE_CNPJ,
    inscricaoEstadual: '111111111111',
    razaoSocial: 'TRANSPORTADORA TESTE LTDA',
    uf: 'SP',
    municipio: 'Sao Paulo',
    codigoMunicipio: '3550308',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64,
    certificadoSenha: CERTIFICATE_PASSWORD,
    serie: '1',
    numeroMdfe: 1,
  }
}

// Formato devolvido por mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx
function buildRegisteredEventoResponse(tpEvento: '110112' | '110111' = '110112'): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><mdfeResultMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento">',
    '<retEventoMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">',
    `<infEvento Id="ID${tpEvento}${MOCK_ACCESS_KEY}01">`,
    '<tpAmb>2</tpAmb><verAplic>SVRS-MDFe-3.00</verAplic><cOrgao>35</cOrgao>',
    '<cStat>135</cStat><xMotivo>Evento registrado e vinculado a MDF-e</xMotivo>',
    `<chMDFe>${MOCK_ACCESS_KEY}</chMDFe><tpEvento>${tpEvento}</tpEvento>`,
    `<xEvento>${tpEvento === '110112' ? 'Encerramento' : 'Cancelamento'}</xEvento><nSeqEvento>1</nSeqEvento>`,
    '<dhRegEvento>2026-07-28T18:12:44-03:00</dhRegEvento><nProt>135260000000002</nProt>',
    '</infEvento></retEventoMDFe></mdfeResultMsg></soap:Body></soap:Envelope>',
  ].join('')
}

function buildRejectedEventoResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><mdfeResultMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento">',
    '<retEventoMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">',
    '<infEvento><tpAmb>2</tpAmb><verAplic>SVRS-MDFe-3.00</verAplic><cOrgao>35</cOrgao>',
    '<cStat>573</cStat><xMotivo>Rejeicao: Duplicidade de evento</xMotivo>',
    `<chMDFe>${MOCK_ACCESS_KEY}</chMDFe><tpEvento>110112</tpEvento><nSeqEvento>1</nSeqEvento>`,
    '</infEvento></retEventoMDFe></mdfeResultMsg></soap:Body></soap:Envelope>',
  ].join('')
}
