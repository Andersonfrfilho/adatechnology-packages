/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, test } from 'bun:test'
import * as forge from 'node-forge'

import { createFiscalProvider, FiscalEnvironment, type CteConfig, type CteData } from '../../src/index'
import { buildCteXml } from '../../src/sefaz/CteXmlBuilder'
import { loadCertificate, signCteXml } from '../../src/sefaz/SefazXmlSigner'

const CERTIFICATE_CNPJ = '11222333000181'
const CERTIFICATE_PASSWORD = 'fixture-password'
const MOCK_ACCESS_KEY = '35260711222333000181570010000000011000000010'
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('CT-e 4.00 schema element names', () => {
  test('names the signed group infCte and carries versao on it', () => {
    const { xml, chaveAcesso } = buildCteXml(buildCteConfig('unused'), buildCteData())

    expect(xml.includes(`<infCte versao="4.00" Id="CTe${chaveAcesso}">`)).toBe(true)
    expect(xml.includes('</infCte>')).toBe(true)
    expect(xml.includes('<infCTe ')).toBe(false)
    expect(xml.includes(`<CTe xmlns="http://www.portalfiscal.inf.br/cte">`)).toBe(true)
    expect(xml.includes('<CTe versao=')).toBe(false)
  })

  test('names the remetente address group enderReme', () => {
    const { xml } = buildCteXml(buildCteConfig('unused'), buildCteData())

    expect(xml.includes('<enderReme>')).toBe(true)
    expect(xml.includes('<enderRem>')).toBe(false)
    expect(xml.includes('<enderDest>')).toBe(true)
  })

  test('keeps expedidor and recebedor address group names untouched', () => {
    const { xml } = buildCteXml(buildCteConfig('unused'), {
      ...buildCteData(),
      expedidor: buildCteData().remetente,
      recebedor: buildCteData().destinatario,
    })

    expect(xml.includes('<enderExped>')).toBe(true)
    expect(xml.includes('<enderReceb>')).toBe(true)
  })

  test('carries the modal version on infModal as versaoModal', () => {
    const { xml } = buildCteXml(buildCteConfig('unused'), buildCteData())

    expect(xml.includes('<infModal versaoModal="4.00">')).toBe(true)
    expect(xml.includes('<infModal versao=')).toBe(false)
  })

  test('formats qCarga with the four decimals required by TDec_1104', () => {
    const data = buildCteData()
    const { xml } = buildCteXml(buildCteConfig('unused'), {
      ...data,
      carga: {
        ...data.carga,
        quantidades: [{ cUnid: '01', tpMed: 'PESO BRUTO', qCarga: 92.765 }],
      },
    })

    expect(xml.includes('<qCarga>92.7650</qCarga>')).toBe(true)
  })

  test('uses the ICMSSN group for a Simples Nacional emitter', () => {
    const { xml } = buildCteXml({ ...buildCteConfig('unused'), crt: '1' }, buildCteData())

    expect(xml.includes('<ICMS><ICMSSN><CST>90</CST><indSN>1</indSN></ICMSSN></ICMS>')).toBe(true)
    expect(xml.includes('<ICMS90')).toBe(false)
  })

  test('keeps the regime normal ICMS groups for a CRT 3 emitter', () => {
    const data = buildCteData()
    const { xml } = buildCteXml(
      { ...buildCteConfig('unused'), crt: '3' },
      { ...data, icms: { cst: '00', vBC: 500, pICMS: 12, vICMS: 60 } },
    )

    expect(xml.includes('<ICMS00><CST>00</CST>')).toBe(true)
    expect(xml.includes('<ICMSSN')).toBe(false)
  })

  // O grupo do CT-e para CST 40/41/51 e ICMS45; ICMS40 so existe no schema da NF-e
  test.each(['40', '41', '51'] as const)(
    'names the isento, nao tributado e diferido group ICMS45 for CST %s',
    (cst) => {
      const data = buildCteData()
      const { xml } = buildCteXml({ ...buildCteConfig('unused'), crt: '3' }, { ...data, icms: { cst } })

      expect(xml.includes(`<ICMS><ICMS45><CST>${cst}</CST></ICMS45></ICMS>`)).toBe(true)
      expect(xml.includes('ICMS40')).toBe(false)
    },
  )

  test('falls back to the ICMS45 group when the CST is unknown', () => {
    const data = buildCteData()
    const { xml } = buildCteXml({ ...buildCteConfig('unused'), crt: '3' }, {
      ...data,
      icms: { cst: '70' },
    } as unknown as CteData)

    expect(xml.includes('<ICMS><ICMS45><CST>41</CST></ICMS45></ICMS>')).toBe(true)
    expect(xml.includes('ICMS40')).toBe(false)
  })

  test('writes serie and nCT without leading zeros in the ide group', () => {
    const { xml, chaveAcesso } = buildCteXml(
      { ...buildCteConfig('unused'), serie: '001', numeroCte: 2 },
      buildCteData(),
    )

    expect(xml.includes('<serie>1</serie>')).toBe(true)
    expect(xml.includes('<nCT>2</nCT>')).toBe(true)
    expect(chaveAcesso.slice(22, 25)).toBe('001')
    expect(chaveAcesso.slice(25, 34)).toBe('000000002')
  })

  test('replaces every participante razao social in homologacao', () => {
    const data = buildCteData()
    const { xml } = buildCteXml(buildCteConfig('unused'), {
      ...data,
      expedidor: { ...data.remetente, xNome: 'EXPEDIDOR TESTE LTDA' },
      recebedor: { ...data.destinatario, xNome: 'RECEBEDOR TESTE LTDA' },
    })

    const homologacaoXNome = '<xNome>CTE EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>'
    expect(xml.split(homologacaoXNome).length - 1).toBe(4)
    expect(xml.includes('<xNome>REMETENTE TESTE LTDA</xNome>')).toBe(false)
    expect(xml.includes('<xNome>DESTINATARIO TESTE LTDA</xNome>')).toBe(false)
    expect(xml.includes('<xNome>EXPEDIDOR TESTE LTDA</xNome>')).toBe(false)
    expect(xml.includes('<xNome>RECEBEDOR TESTE LTDA</xNome>')).toBe(false)
  })

  test('keeps the real participante razao social in producao', () => {
    const { xml } = buildCteXml(
      { ...buildCteConfig('unused'), environment: FiscalEnvironment.PRODUCAO },
      buildCteData(),
    )

    expect(xml.includes('<xNome>REMETENTE TESTE LTDA</xNome>')).toBe(true)
    expect(xml.includes('<xNome>DESTINATARIO TESTE LTDA</xNome>')).toBe(true)
  })

  test('carries the qrCodCTe supplementary group after infCte', () => {
    const { xml, chaveAcesso } = buildCteXml(buildCteConfig('unused'), buildCteData())

    expect(
      xml.includes(
        `</infCte><infCTeSupl><qrCodCTe>https://homologacao.nfe.fazenda.sp.gov.br/CTeConsulta/qrCode?chCTe=${chaveAcesso}&amp;tpAmb=2</qrCodCTe></infCTeSupl>`,
      ),
    ).toBe(true)
  })

  test('points the qrCodCTe to the producao portal when emitting in producao', () => {
    const { xml } = buildCteXml(
      { ...buildCteConfig('unused'), environment: FiscalEnvironment.PRODUCAO },
      buildCteData(),
    )

    expect(xml.includes('<qrCodCTe>https://nfe.fazenda.sp.gov.br/CTeConsulta/qrCode?chCTe=')).toBe(true)
    expect(xml.includes('&amp;tpAmb=1</qrCodCTe>')).toBe(true)
  })

  test('places the signature after infCTeSupl', () => {
    const certificateFixture = createCertificateFixture()
    const certData = loadCertificate(certificateFixture.pfxBase64, CERTIFICATE_PASSWORD)
    const { xml } = buildCteXml(buildCteConfig('unused'), buildCteData())
    const { signedXml } = signCteXml(xml, certData)

    expect(signedXml.indexOf('<infCTeSupl>')).toBeGreaterThan(signedXml.indexOf('</infCte>'))
    expect(signedXml.indexOf('<Signature')).toBeGreaterThan(signedXml.indexOf('</infCTeSupl>'))
  })

  test('signs the infCte group produced by the builder', () => {
    const certificateFixture = createCertificateFixture()
    const certData = loadCertificate(certificateFixture.pfxBase64, CERTIFICATE_PASSWORD)
    const { xml, chaveAcesso } = buildCteXml(buildCteConfig(certificateFixture.pfxBase64), buildCteData())

    const { signedXml } = signCteXml(xml, certData)

    expect(signedXml.includes(`<Reference URI="#CTe${chaveAcesso}">`)).toBe(true)
    expect(signedXml.includes('<SignatureValue>')).toBe(true)
    expect(signedXml.indexOf('<Signature')).toBeGreaterThan(signedXml.indexOf('</infCte>'))
  })
})

describe('CTeRecepcaoSincV4 wire format', () => {
  test('sends the CT-e as GZip+Base64 inside cteDadosMsg', async () => {
    const certificateFixture = createCertificateFixture()
    let requestBody = ''

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(buildAuthorizedCteResponse(), { status: 200 })
    }

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'wire-contract-test',
      config,
      cteData: buildCteData(),
      items: [],
      payments: [],
      totalAmount: 500,
      discountAmount: 0,
    })

    expect(result.success).toBe(true)

    const payload = requestBody.match(/<cteDadosMsg[^>]*>([^<]*)<\/cteDadosMsg>/)?.[1] ?? ''
    expect(payload.length).toBeGreaterThan(0)
    expect(payload.includes('<')).toBe(false)

    const decompressed = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8')
    expect(decompressed.startsWith('<CTe ')).toBe(true)
    expect(decompressed.includes('<infCte ')).toBe(true)
    expect(decompressed.includes('<Signature')).toBe(true)
    expect(decompressed.includes('<?xml')).toBe(false)
  })

  test('never leaks certificate material into the transported payload', async () => {
    const certificateFixture = createCertificateFixture()
    let requestBody = ''

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(buildAuthorizedCteResponse(), { status: 200 })
    }

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    await provider.emit({
      referenceId: 'wire-contract-test',
      config,
      cteData: buildCteData(),
      items: [],
      payments: [],
      totalAmount: 500,
      discountAmount: 0,
    })

    const payload = requestBody.match(/<cteDadosMsg[^>]*>([^<]*)<\/cteDadosMsg>/)?.[1] ?? ''
    const decompressed = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8')

    expect(requestBody.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(decompressed.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(decompressed.includes(certificateFixture.pfxBase64)).toBe(false)
  })
})

describe('CTeRecepcaoSincV4 response parsing', () => {
  test('reads the authorization from cteRecepcaoResult > retCTe', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> => new Response(buildSefazSpAuthorizedResponse(), { status: 200 })

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'wire-contract-test',
      config,
      cteData: buildCteData(),
      items: [],
      payments: [],
      totalAmount: 500,
      discountAmount: 0,
    })

    expect(result.success).toBe(true)
    expect(result.chaveAcesso).toBe(MOCK_ACCESS_KEY)
    expect(result.protocolo).toBe('135260000000001')
  })

  test('surfaces the SEFAZ cStat and xMotivo when retCTe rejects the CT-e', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> => new Response(buildSefazSpRejectedResponse(), { status: 200 })

    const config = buildCteConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'wire-contract-test',
      config,
      cteData: buildCteData(),
      items: [],
      payments: [],
      totalAmount: 500,
      discountAmount: 0,
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('215')
    expect(result.errorMessage).toContain('Falha no schema XML')
  })
})

describe('createFiscalProvider error message', () => {
  test('reports the unknown model without echoing the configuration', () => {
    const secretConfig = {
      model: 'modelo-inexistente',
      certificadoBase64: 'BASE64-DO-CERTIFICADO',
      certificadoSenha: 'senha-do-certificado',
    }

    expect(() => createFiscalProvider(secretConfig as never)).toThrow('Modelo fiscal desconhecido: modelo-inexistente')

    try {
      createFiscalProvider(secretConfig as never)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message.includes(secretConfig.certificadoBase64)).toBe(false)
      expect(message.includes(secretConfig.certificadoSenha)).toBe(false)
    }
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

function buildCteConfig(certificadoBase64: string): CteConfig {
  return {
    model: 'cte',
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
    municipioOrigem: { codigo: '3550308', nome: 'Sao Paulo', uf: 'SP' },
    municipioDestino: { codigo: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
    remetente: {
      cnpj: CERTIFICATE_CNPJ,
      xNome: 'REMETENTE TESTE LTDA',
      xLgr: 'Rua Teste',
      nro: '1',
      xBairro: 'Centro',
      cMun: '3550308',
      xMun: 'Sao Paulo',
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
    modal: { modal: '01', rntrc: '00000000' },
  }
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

// Formato real devolvido por homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoSincV4.asmx
function buildSefazSpAuthorizedResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><cteRecepcaoResult xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4">',
    '<retCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">',
    '<tpAmb>2</tpAmb><cUF>35</cUF><verAplic>SP-CTe-2026-07-01-1</verAplic>',
    '<cStat>100</cStat><xMotivo>Autorizado o uso do CT-e</xMotivo>',
    '<protCTe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>SP-CTe-2026-07-01-1</verAplic>',
    `<chCTe>${MOCK_ACCESS_KEY}</chCTe><dhRecbto>2026-07-27T20:17:33-03:00</dhRecbto>`,
    '<nProt>135260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado o uso do CT-e</xMotivo>',
    '</infProt></protCTe></retCTe></cteRecepcaoResult></soap:Body></soap:Envelope>',
  ].join('')
}

function buildSefazSpRejectedResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><cteRecepcaoResult xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4">',
    '<retCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">',
    '<tpAmb>2</tpAmb><cUF>35</cUF><verAplic>SP-CTe-2026-07-01-1</verAplic>',
    '<cStat>215</cStat>',
    "<xMotivo>Rejeição: Falha no schema XML [Detalhes: The required attribute 'versaoModal' is missing.].</xMotivo>",
    '</retCTe></cteRecepcaoResult></soap:Body></soap:Envelope>',
  ].join('')
}
