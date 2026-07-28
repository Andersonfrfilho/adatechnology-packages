/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { gunzipSync } from 'node:zlib'

import { afterEach, describe, expect, test } from 'bun:test'
import * as forge from 'node-forge'
import {
  createFiscalProvider,
  FiscalConnectionError,
  FiscalEnvironment,
  FiscalError,
  FiscalRejectionError,
  FiscalTimeoutError,
  SefazCteProvider,
  validateCertificate,
  type CteConfig,
  type CteData,
  type EmitFiscalParams,
} from '../../src/index'
import { buildCteXml } from '../../src/sefaz/CteXmlBuilder'

const CERTIFICATE_CNPJ = '11222333000181'
const CERTIFICATE_PASSWORD = 'fixture-password'
const MOCK_ACCESS_KEY = '35260711222333000181570010000000011000000010'
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('@adatechnology/fiscal-provider public CT-e contract', () => {
  test('creates the CT-e provider through the public factory', () => {
    const provider = createFiscalProvider(buildCteConfig(createCertificateFixture().pfxBase64))

    expect(provider).toBeInstanceOf(SefazCteProvider)
    expect(typeof provider.emit).toBe('function')
    expect(typeof provider.cancel).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  test('keeps the application-to-provider environment mapping explicit', () => {
    const environmentMapping = {
      homologation: FiscalEnvironment.HOMOLOGACAO,
      production: FiscalEnvironment.PRODUCAO,
    } as const

    expect(environmentMapping.homologation).toBe('homologacao')
    expect(environmentMapping.production).toBe('producao')
  })

  test('validates an in-memory signing certificate without persisting secrets', () => {
    const certificateFixture = createCertificateFixture()
    const validation = validateCertificate(certificateFixture.pfxBase64, CERTIFICATE_PASSWORD)

    expect(validation.valid).toBe(true)
    expect(validation.hasPrivateKey).toBe(true)
    expect(validation.isIcpBrasil).toBe(true)
    expect(validation.hasCnpj).toBe(true)
    expect(validation.cnpj).toBe(CERTIFICATE_CNPJ)
    expect(validation.canSign).toBe(true)
    expect(validation.hasClientAuth).toBe(true)
    expect(validation.errors).toEqual([])
  })

  test('signs CT-e locally and sends it only through the mocked transport', async () => {
    const certificateFixture = createCertificateFixture()
    let requestUrl = ''
    let requestBody = ''

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestUrl = String(input)
      requestBody = typeof init?.body === 'string' ? init.body : ''

      return new Response(buildAuthorizedCteResponse(), {
        status: 200,
        headers: { 'Content-Type': 'application/soap+xml' },
      })
    }

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'contract-test-cte',
      config,
      cteData: buildCteData(),
      items: [],
      payments: [],
      totalAmount: 500,
      discountAmount: 0,
    })

    expect(result.success).toBe(true)
    expect(result.chaveAcesso).toBe(MOCK_ACCESS_KEY)
    expect(requestUrl.startsWith('https://')).toBe(true)

    const transportedPayload = requestBody.match(/<cteDadosMsg[^>]*>([^<]*)<\/cteDadosMsg>/)?.[1] ?? ''
    const transportedCte = gunzipSync(Buffer.from(transportedPayload, 'base64')).toString('utf8')
    expect(transportedCte.includes('<Signature')).toBe(true)

    expect(requestBody.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(requestBody.includes(certificateFixture.pfxBase64)).toBe(false)
  })
})

describe('@adatechnology/fiscal-provider CT-e authorized XML', () => {
  test('assembles the cteProc from the signed CT-e and the SEFAZ protocol', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> =>
      new Response(buildAuthorizedCteResponse(), {
        status: 200,
        headers: { 'Content-Type': 'application/soap+xml' },
      })

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit(buildEmitParams(config))

    expect(result.success).toBe(true)
    expect(result.xmlAutorizado).toBeDefined()

    const authorizedXml = result.xmlAutorizado ?? ''
    expect(authorizedXml.startsWith('<?xml version="1.0" encoding="UTF-8"?><cteProc versao="4.00"')).toBe(true)
    expect(authorizedXml.includes('xmlns="http://www.portalfiscal.inf.br/cte"')).toBe(true)
    expect(authorizedXml.includes('<Signature')).toBe(true)
    expect(authorizedXml.includes(`<chCTe>${MOCK_ACCESS_KEY}</chCTe>`)).toBe(true)
    expect(authorizedXml.includes('<nProt>135260000000001</nProt>')).toBe(true)
    expect(authorizedXml.endsWith('</cteProc>')).toBe(true)
    expect(authorizedXml.indexOf('<protCTe')).toBeGreaterThan(authorizedXml.indexOf('<CTe'))
  })

  test('never leaks certificate material into the authorized XML', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> => new Response(buildAuthorizedCteResponse(), { status: 200 })

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit(buildEmitParams(config))

    const authorizedXml = result.xmlAutorizado ?? ''
    expect(authorizedXml.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(authorizedXml.includes(certificateFixture.pfxBase64)).toBe(false)
  })

  test('omits the authorized XML when SEFAZ rejects the CT-e', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> => new Response(buildRejectedCteResponse(), { status: 200 })

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit(buildEmitParams(config))

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('539')
    expect(result.xmlAutorizado).toBeUndefined()
  })
})

describe('@adatechnology/fiscal-provider CT-e XML parameters', () => {
  const config = buildCteConfig('unused-for-xml-only-assertions')

  test('takes retira, xDetRetira and indIEToma from the caller', () => {
    const { xml } = buildCteXml(config, {
      ...buildCteData(),
      retira: '0',
      xDetRetira: 'Retirar no terminal 3 mediante apresentacao do documento',
      indIEToma: '1',
    })

    expect(xml.includes('<retira>0</retira>')).toBe(true)
    expect(xml.includes('<xDetRetira>Retirar no terminal 3 mediante apresentacao do documento</xDetRetira>')).toBe(true)
    expect(xml.includes('<indIEToma>1</indIEToma>')).toBe(true)
    expect(xml.indexOf('<xDetRetira>')).toBeGreaterThan(xml.indexOf('<retira>'))
  })

  test('falls back to door delivery and non-taxpayer tomador when omitted', () => {
    const { xml } = buildCteXml(config, buildCteData())

    expect(xml.includes('<retira>1</retira>')).toBe(true)
    expect(xml.includes('<indIEToma>9</indIEToma>')).toBe(true)
    expect(xml.includes('<xDetRetira>')).toBe(false)
  })

  test('emits vCargaAverb after the infQ list, with two decimals', () => {
    const { xml } = buildCteXml(config, {
      ...buildCteData(),
      carga: { ...buildCteData().carga, vCargaAverb: 958.4 },
    })

    expect(xml.includes('<vCargaAverb>958.40</vCargaAverb>')).toBe(true)
    expect(xml.indexOf('<vCargaAverb>')).toBeGreaterThan(xml.indexOf('<infQ>'))
    expect(xml.indexOf('<vCargaAverb>')).toBeLessThan(xml.indexOf('</infCarga>'))
  })

  test('emits dPrev inside infNFe right after the access key', () => {
    const referencedKey = '35260705868574001090550020008526741408978623'
    const { xml } = buildCteXml(config, {
      ...buildCteData(),
      documentos: [{ tipo: 'nfe', chave: referencedKey, dPrev: '2026-07-14' }],
    })

    expect(xml.includes(`<infNFe><chave>${referencedKey}</chave><dPrev>2026-07-14</dPrev></infNFe>`)).toBe(true)
  })

  test('omits vCargaAverb and dPrev when the caller does not provide them', () => {
    const { xml } = buildCteXml(config, {
      ...buildCteData(),
      documentos: [{ tipo: 'nfe', chave: '35260705868574001090550020008526741408978623' }],
    })

    expect(xml.includes('<vCargaAverb>')).toBe(false)
    expect(xml.includes('<dPrev>')).toBe(false)
  })
})

describe('@adatechnology/fiscal-provider public errors', () => {
  test('preserves the specialized error hierarchy and stable codes', () => {
    const connectionError = new FiscalConnectionError('SEFAZ CT-e', 'connection refused')
    const rejectionPayload = { cStat: '225' }
    const rejectionError = new FiscalRejectionError('225', 'Falha no schema XML', rejectionPayload)
    const timeoutError = new FiscalTimeoutError('SEFAZ CT-e')

    expect(connectionError).toBeInstanceOf(FiscalError)
    expect(connectionError.name).toBe('FiscalConnectionError')
    expect(connectionError.code).toBe('FISCAL_CONNECTION_ERROR')

    expect(rejectionError).toBeInstanceOf(FiscalError)
    expect(rejectionError.name).toBe('FiscalRejectionError')
    expect(rejectionError.code).toBe('225')
    expect(rejectionError.rawResponse).toBe(rejectionPayload)

    expect(timeoutError).toBeInstanceOf(FiscalError)
    expect(timeoutError.name).toBe('FiscalTimeoutError')
    expect(timeoutError.code).toBe('FISCAL_TIMEOUT')
  })
})

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
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
    },
    {
      name: 'extKeyUsage',
      clientAuth: true,
    },
    {
      name: 'subjectAltName',
      altNames: [{ type: 2, value: 'fiscal-contract.test' }],
    },
  ])
  certificate.sign(keyPair.privateKey, forge.md.sha256.create())

  const pkcs12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, [certificate], CERTIFICATE_PASSWORD, {
    algorithm: '3des',
  })
  const pfxDer = forge.asn1.toDer(pkcs12).getBytes()

  return { pfxBase64: forge.util.encode64(pfxDer) }
}

function buildCteConfig(certificadoBase64: string): CteConfig {
  return {
    model: 'cte',
    environment: FiscalEnvironment.HOMOLOGACAO,
    cnpj: CERTIFICATE_CNPJ,
    inscricaoEstadual: '111111111111',
    razaoSocial: 'TRANSPORTADORA TESTE LTDA',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipio: '3550308',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64,
    certificadoSenha: CERTIFICATE_PASSWORD,
    serie: '1',
    numeroCte: 1,
    rntrc: '00000000',
  }
}

function buildCteData(): CteData {
  return {
    cfop: '6353',
    naturezaOperacao: 'PRESTACAO DE SERVICO DE TRANSPORTE',
    tipoServico: '0',
    tomador: '3',
    municipioOrigem: { codigo: '3550308', nome: 'São Paulo', uf: 'SP' },
    municipioDestino: { codigo: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
    remetente: {
      cnpj: CERTIFICATE_CNPJ,
      xNome: 'REMETENTE TESTE LTDA',
      xLgr: 'Rua Teste',
      nro: '1',
      xBairro: 'Centro',
      cMun: '3550308',
      xMun: 'São Paulo',
      uf: 'SP',
      cep: '01001000',
    },
    destinatario: {
      cnpj: '99888777000100',
      xNome: 'DESTINATARIO TESTE LTDA',
      xLgr: 'Rua Destino',
      nro: '200',
      xBairro: 'Flamengo',
      cMun: '3304557',
      xMun: 'Rio de Janeiro',
      uf: 'RJ',
      cep: '22210030',
    },
    valorTotalPrestacao: 500,
    valorTotalReceber: 500,
    componentesValor: [{ xNome: 'FRETE', vComp: 500 }],
    icms: { cst: '40' },
    carga: {
      vCarga: 5000,
      proPred: 'CARGA GERAL',
      quantidades: [{ cUnid: '00', tpMed: 'PESO BRUTO', qCarga: 100 }],
    },
    documentos: [{ tipo: 'outro', tpDoc: '00' }],
    modal: {
      modal: '01',
      rntrc: '00000000',
    },
  }
}

function buildEmitParams(config: CteConfig): EmitFiscalParams {
  return {
    referenceId: 'contract-test-cte',
    config,
    cteData: buildCteData(),
    items: [],
    payments: [],
    totalAmount: 500,
    discountAmount: 0,
  }
}

function buildRejectedCteResponse(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '<soap12:Body><cteRecepcaoResult><retCTeSinc>',
    '<cStat>539</cStat><xMotivo>Duplicidade de CT-e com diferenca na chave de acesso</xMotivo>',
    '</retCTeSinc></cteRecepcaoResult></soap12:Body></soap12:Envelope>',
  ].join('')
}

function buildAuthorizedCteResponse(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '<soap12:Body><cteRecepcaoResult><retCTeSinc>',
    '<cStat>100</cStat><xMotivo>Autorizado o uso do CT-e</xMotivo>',
    `<protCTe><infProt><chCTe>${MOCK_ACCESS_KEY}</chCTe><nProt>135260000000001</nProt></infProt></protCTe>`,
    '</retCTeSinc></cteRecepcaoResult></soap12:Body></soap12:Envelope>',
  ].join('')
}
