/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, test } from 'bun:test'
import * as forge from 'node-forge'

import { createFiscalProvider, FiscalEnvironment, type MdfeConfig, type MdfeData } from '../../src/index'
import { buildMdfeXml } from '../../src/sefaz/MdfeXmlBuilder'
import { loadCertificate, signMdfeXml } from '../../src/sefaz/SefazXmlSigner'

const CERTIFICATE_CNPJ = '11222333000181'
const CERTIFICATE_PASSWORD = 'fixture-password'
const MOCK_ACCESS_KEY = '35260711222333000181580010000000011000000018'
const MOCK_CTE_KEY = '35260711222333000181570010000000011000000010'
const MOCK_NFE_KEY = '35260799888777000100550010000000011000000015'
const SVRS_HOMOLOGACAO_SINC = 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx'
const SVRS_PRODUCAO_SINC = 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx'
const MDFE_SINC_NS = 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc'
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('MDF-e 3.00 schema element names', () => {
  test('names the signed group infMDFe and carries versao 3.00 on it', () => {
    const { xml, chaveAcesso } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes(`<infMDFe versao="3.00" Id="MDFe${chaveAcesso}">`)).toBe(true)
    expect(xml.includes('</infMDFe>')).toBe(true)
    expect(xml.includes('<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">')).toBe(true)
    expect(xml.includes('<MDFe versao=')).toBe(false)
  })

  test('emits modelo 58 in the ide group and inside the access key', () => {
    const { xml, chaveAcesso } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<mod>58</mod>')).toBe(true)
    expect(chaveAcesso).toHaveLength(44)
    expect(chaveAcesso.slice(20, 22)).toBe('58')
    expect(chaveAcesso.slice(0, 2)).toBe('35')
    expect(chaveAcesso.slice(6, 20)).toBe(CERTIFICATE_CNPJ)
  })

  // O MDF-e usa o modal em um dígito (1..4); o CT-e usa dois ('01'..'04')
  test('writes the modal as a single digit', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<modal>1</modal>')).toBe(true)
    expect(xml.includes('<modal>01</modal>')).toBe(false)
  })

  test('carries the modal version on infModal as versaoModal', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<infModal versaoModal="3.00"><rodo>')).toBe(true)
    expect(xml.includes('<infModal versao=')).toBe(false)
  })

  test('keeps the ide sequence required by the schema', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...buildMdfeData(),
      ufsPercurso: ['MG'],
    })

    const ide = xml.match(/<ide>([\s\S]*?)<\/ide>/)?.[1] ?? ''
    const order = [
      '<cUF>',
      '<tpAmb>',
      '<tpEmit>',
      '<mod>',
      '<serie>',
      '<nMDF>',
      '<cMDF>',
      '<cDV>',
      '<modal>',
      '<dhEmi>',
      '<tpEmis>',
      '<procEmi>',
      '<verProc>',
      '<UFIni>',
      '<UFFim>',
      '<infMunCarrega>',
      '<infPercurso>',
    ]
    const positions = order.map((tag) => ide.indexOf(tag))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((first, second) => first - second))
    expect(ide.includes('<UFPer>MG</UFPer>')).toBe(true)
  })

  test('keeps the infMDFe sequence required by the schema', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    const order = ['<ide>', '<emit>', '<infModal ', '<infDoc>', '<prodPred>', '<tot>', '<infAdic>']
    const positions = order.map((tag) => xml.indexOf(tag))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((first, second) => first - second))
  })

  test('groups the transported documents under the municipio de descarga', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(
      xml.includes(
        `<infMunDescarga><cMunDescarga>3304557</cMunDescarga><xMunDescarga>Rio de Janeiro</xMunDescarga>` +
          `<infCTe><chCTe>${MOCK_CTE_KEY}</chCTe></infCTe><infNFe><chNFe>${MOCK_NFE_KEY}</chNFe></infNFe></infMunDescarga>`,
      ),
    ).toBe(true)
  })

  // qCTe/qNFe são a contagem dos documentos declarados — nunca vêm do chamador
  test('derives qCTe and qNFe from the declared documents', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<tot><qCTe>1</qCTe><qNFe>1</qNFe>')).toBe(true)
  })

  test('formats vCarga with two decimals and qCarga with the four required by TDec_1104', () => {
    const data = buildMdfeData()
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...data,
      totais: { vCarga: 5000, cUnid: '01', qCarga: 92.765 },
    })

    expect(xml.includes('<vCarga>5000.00</vCarga><cUnid>01</cUnid><qCarga>92.7650</qCarga>')).toBe(true)
  })

  test('writes serie and nMDF without leading zeros in the ide group', () => {
    const { xml, chaveAcesso } = buildMdfeXml(
      { ...buildMdfeConfig('unused'), serie: '001', numeroMdfe: 2 },
      buildMdfeData(),
    )

    expect(xml.includes('<serie>1</serie>')).toBe(true)
    expect(xml.includes('<nMDF>2</nMDF>')).toBe(true)
    expect(chaveAcesso.slice(22, 25)).toBe('001')
    expect(chaveAcesso.slice(25, 34)).toBe('000000002')
  })

  // Rejeição 726 na SVRS: carga lotação exige o infLotacao dentro do prodPred
  test('declares infLotacao inside prodPred, after the NCM', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...buildMdfeData(),
      produtoPredominante: {
        tipoCarga: '05',
        descricao: 'CARGA GERAL',
        ncm: '84713012',
        lotacao: { cepCarregamento: '01001-000', cepDescarregamento: '22210-030' },
      },
    })

    expect(
      xml.includes(
        '<prodPred><tpCarga>05</tpCarga><xProd>CARGA GERAL</xProd><NCM>84713012</NCM>' +
          '<infLotacao><infLocalCarrega><CEP>01001000</CEP></infLocalCarrega>' +
          '<infLocalDescarrega><CEP>22210030</CEP></infLocalDescarrega></infLotacao></prodPred>',
      ),
    ).toBe(true)
  })

  test('omits infLotacao when the carga is not lotacao', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<infLotacao>')).toBe(false)
  })

  // Rejeição 578 na SVRS: sem infContratante o manifesto não autoriza quando há tomador
  test('declares the contratantes inside infANTT, after the RNTRC', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...buildMdfeData(),
      contratantes: [{ cnpj: '11.222.333/0001-81' }, { cpf: '111.444.777-35' }],
    })

    expect(
      xml.includes(
        '<infANTT><RNTRC>12345678</RNTRC>' +
          '<infContratante><CNPJ>11222333000181</CNPJ></infContratante>' +
          '<infContratante><CPF>11144477735</CPF></infContratante></infANTT>',
      ),
    ).toBe(true)
  })

  test('omits infContratante when no contratante is informed', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<infContratante>')).toBe(false)
  })

  // Rejeição 302 na SVRS: carga lotação exige o infPag, e ele fecha o infANTT
  test('declares infPag after the contratantes, with the componentes and vContrato', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...buildMdfeData(),
      contratantes: [{ cnpj: '11222333000181' }],
      pagamentos: [
        {
          nome: 'CONTRATANTE TESTE',
          cnpj: '11.222.333/0001-81',
          componentes: [{ tipoComponente: '01', valor: 150 }],
          valorContrato: 1500,
          indicadorPagamento: '0',
          dadosBancarios: { codigoBanco: '341', codigoAgencia: '1234' },
        },
      ],
    })

    // infBanc é obrigatório mesmo à vista — sem ele a SVRS rejeita com 580 (conteúdo incompleto)
    expect(
      xml.includes(
        '<infContratante><CNPJ>11222333000181</CNPJ></infContratante>' +
          '<infPag><xNome>CONTRATANTE TESTE</xNome><CNPJ>11222333000181</CNPJ>' +
          '<Comp><tpComp>01</tpComp><vComp>150.00</vComp></Comp>' +
          '<vContrato>1500.00</vContrato><indPag>0</indPag>' +
          '<infBanc><codBanco>341</codBanco><codAgencia>1234</codAgencia></infBanc></infPag></infANTT>',
      ),
    ).toBe(true)
  })

  // A prazo exige as parcelas e os dados bancários — sem eles a SVRS rejeita com 583
  test('declares infPrazo and infBanc when the frete is a prazo', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...buildMdfeData(),
      pagamentos: [
        {
          cpf: '111.444.777-35',
          componentes: [{ tipoComponente: '99', valor: 80.5, descricao: 'PEDAGIO EXTRA' }],
          valorContrato: 2000,
          indicadorPagamento: '1',
          parcelas: [{ numero: 1, vencimento: '2026-08-15', valor: 2000 }],
          dadosBancarios: { pix: 'financeiro@transportadora.com.br' },
        },
      ],
    })

    expect(
      xml.includes(
        '<infPag><CPF>11144477735</CPF>' +
          '<Comp><tpComp>99</tpComp><vComp>80.50</vComp><xComp>PEDAGIO EXTRA</xComp></Comp>' +
          '<vContrato>2000.00</vContrato><indPag>1</indPag>' +
          '<infPrazo><nParcela>1</nParcela><dVenc>2026-08-15</dVenc><vParcela>2000.00</vParcela></infPrazo>' +
          '<infBanc><PIX>financeiro@transportadora.com.br</PIX></infBanc></infPag>',
      ),
    ).toBe(true)
  })

  test('omits infPag when no pagamento is informed', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<infPag>')).toBe(false)
  })

  // Um & na razão social ou na observação produz XML inválido e a assinatura vai junto
  test('escapes the free text of the emitente, do produto e das observacoes', () => {
    const { xml } = buildMdfeXml(
      { ...buildMdfeConfig('unused'), razaoSocial: 'TRANSPORTES A & B LTDA', bairro: '<Centro>' },
      {
        ...buildMdfeData(),
        produtoPredominante: { tipoCarga: '05', descricao: 'PECAS & ACESSORIOS' },
        informacoesAdicionais: 'Carga "frágil" & urgente',
      },
    )

    expect(xml.includes('<xNome>TRANSPORTES A &amp; B LTDA</xNome>')).toBe(true)
    expect(xml.includes('<xBairro>&lt;Centro&gt;</xBairro>')).toBe(true)
    expect(xml.includes('<xProd>PECAS &amp; ACESSORIOS</xProd>')).toBe(true)
    expect(xml.includes('<infCpl>Carga &quot;frágil&quot; &amp; urgente</infCpl>')).toBe(true)
  })

  test('escapes the free text of the condutor, do municipio e do pagamento', () => {
    const data = buildMdfeData()
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), {
      ...data,
      municipiosCarregamento: [{ codigo: '3550308', nome: 'SANTA BARBARA D&#39;OESTE' }],
      veiculoTracao: {
        ...data.veiculoTracao,
        condutores: [{ nome: 'JOAO & MARIA', cpf: '11144477735' }],
      },
      pagamentos: [
        {
          nome: 'CONTRATANTE A & B',
          cnpj: '11222333000181',
          componentes: [{ tipoComponente: '99', valor: 10, descricao: 'TAXA & PEDAGIO' }],
          valorContrato: 10,
          indicadorPagamento: '0',
          dadosBancarios: { pix: 'a&b@transportadora.com.br' },
        },
      ],
    })

    expect(xml.includes('<xMunCarrega>SANTA BARBARA D&amp;#39;OESTE</xMunCarrega>')).toBe(true)
    expect(xml.includes('<condutor><xNome>JOAO &amp; MARIA</xNome>')).toBe(true)
    expect(xml.includes('<xNome>CONTRATANTE A &amp; B</xNome>')).toBe(true)
    expect(xml.includes('<xComp>TAXA &amp; PEDAGIO</xComp>')).toBe(true)
    expect(xml.includes('<PIX>a&amp;b@transportadora.com.br</PIX>')).toBe(true)
  })

  test('declares the RNTRC and the veiculo de tracao inside rodo', () => {
    const { xml } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(xml.includes('<rodo><infANTT><RNTRC>12345678</RNTRC></infANTT>')).toBe(true)
    expect(
      xml.includes(
        '<veicTracao><cInt>1</cInt><placa>ABC1D23</placa><RENAVAM>12345678901</RENAVAM><tara>7500</tara>' +
          '<capKG>25000</capKG><condutor><xNome>MOTORISTA TESTE</xNome><CPF>12345678909</CPF></condutor>' +
          '<tpRod>03</tpRod><tpCar>02</tpCar><UF>SP</UF></veicTracao>',
      ),
    ).toBe(true)
  })

  test('carries the qrCodMDFe supplementary group as CDATA after infMDFe', () => {
    const { xml, chaveAcesso } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    expect(
      xml.includes(
        `</infMDFe><infMDFeSupl><qrCodMDFe><![CDATA[https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?chMDFe=${chaveAcesso}&tpAmb=2]]></qrCodMDFe></infMDFeSupl>`,
      ),
    ).toBe(true)
  })

  test('points the qrCodMDFe to producao when emitting in producao', () => {
    const { xml } = buildMdfeXml(
      { ...buildMdfeConfig('unused'), environment: FiscalEnvironment.PRODUCAO },
      buildMdfeData(),
    )

    expect(xml.includes('<tpAmb>1</tpAmb>')).toBe(true)
    expect(xml.includes('&tpAmb=1]]></qrCodMDFe>')).toBe(true)
  })

  test('signs the infMDFe group and places the Signature after infMDFeSupl', () => {
    const certificateFixture = createCertificateFixture()
    const certData = loadCertificate(certificateFixture.pfxBase64, CERTIFICATE_PASSWORD)
    const { xml, chaveAcesso } = buildMdfeXml(buildMdfeConfig('unused'), buildMdfeData())

    const { signedXml } = signMdfeXml(xml, certData)

    expect(signedXml.includes(`<Reference URI="#MDFe${chaveAcesso}">`)).toBe(true)
    expect(signedXml.includes('<SignatureValue>')).toBe(true)
    expect(signedXml.indexOf('<infMDFeSupl>')).toBeGreaterThan(signedXml.indexOf('</infMDFe>'))
    expect(signedXml.indexOf('<Signature')).toBeGreaterThan(signedXml.indexOf('</infMDFeSupl>'))
  })
})

describe('MDFeRecepcaoSinc wire format', () => {
  test('sends the MDF-e as GZip+Base64 inside mdfeDadosMsg', async () => {
    const certificateFixture = createCertificateFixture()
    let requestBody = ''

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(buildAuthorizedMdfeResponse(), { status: 200 })
    }

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      mdfeData: buildMdfeData(),
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    expect(result.success).toBe(true)

    const payload = requestBody.match(/<mdfeDadosMsg[^>]*>([^<]*)<\/mdfeDadosMsg>/)?.[1] ?? ''
    expect(payload.length).toBeGreaterThan(0)
    expect(payload.includes('<')).toBe(false)

    const decompressed = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8')
    expect(decompressed.startsWith('<MDFe ')).toBe(true)
    expect(decompressed.includes('<infMDFe ')).toBe(true)
    expect(decompressed.includes('<Signature')).toBe(true)
    expect(decompressed.includes('<?xml')).toBe(false)
    // O envio síncrono manda o <MDFe> nu — enviMDFe é do fluxo assíncrono desativado em 2024-06-30
    expect(decompressed.includes('<enviMDFe')).toBe(false)
  })

  test('addresses the SVRS national authorizer and the mdfeRecepcao SOAPAction', async () => {
    const certificateFixture = createCertificateFixture()
    let requestUrl = ''
    let soapAction = ''
    let namespace = ''

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestUrl = String(input)
      soapAction = new Headers(init?.headers).get('SOAPAction') ?? ''
      namespace = (typeof init?.body === 'string' ? init.body : '').match(/<mdfeDadosMsg xmlns="([^"]+)"/)?.[1] ?? ''
      return new Response(buildAuthorizedMdfeResponse(), { status: 200 })
    }

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      mdfeData: buildMdfeData(),
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    expect(requestUrl).toBe(SVRS_HOMOLOGACAO_SINC)
    expect(namespace).toBe(MDFE_SINC_NS)
    expect(soapAction).toBe(`"${MDFE_SINC_NS}/mdfeRecepcao"`)
  })

  // A SVRS é o autorizador nacional único do MDF-e — nenhuma UF tem servidor próprio
  test.each(['SP', 'MG', 'PR', 'RS', 'MT'] as const)('routes %s to the same SVRS endpoint', async (uf) => {
    const certificateFixture = createCertificateFixture()
    let requestUrl = ''

    globalThis.fetch = async (input: string | URL | Request): Promise<Response> => {
      requestUrl = String(input)
      return new Response(buildAuthorizedMdfeResponse(), { status: 200 })
    }

    const config: MdfeConfig = {
      ...buildMdfeConfig(certificateFixture.pfxBase64),
      uf,
      environment: FiscalEnvironment.PRODUCAO,
    }
    const provider = createFiscalProvider(config)
    await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      mdfeData: buildMdfeData(),
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    expect(requestUrl).toBe(SVRS_PRODUCAO_SINC)
  })

  test('never leaks certificate material into the transported payload', async () => {
    const certificateFixture = createCertificateFixture()
    let requestBody = ''

    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(buildAuthorizedMdfeResponse(), { status: 200 })
    }

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      mdfeData: buildMdfeData(),
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    const payload = requestBody.match(/<mdfeDadosMsg[^>]*>([^<]*)<\/mdfeDadosMsg>/)?.[1] ?? ''
    const decompressed = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8')

    expect(requestBody.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(decompressed.includes(CERTIFICATE_PASSWORD)).toBe(false)
    expect(decompressed.includes(certificateFixture.pfxBase64)).toBe(false)
  })

  test('rejects the emission when mdfeData is missing, before touching the network', async () => {
    const certificateFixture = createCertificateFixture()
    let called = false

    globalThis.fetch = async (): Promise<Response> => {
      called = true
      return new Response(buildAuthorizedMdfeResponse(), { status: 200 })
    }

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('MISSING_MDFE_DATA')
    expect(called).toBe(false)
  })
})

describe('MDFeRecepcaoSinc response parsing', () => {
  test('reads the authorization from mdfeResultMsg > retMDFe and returns the mdfeProc', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> => new Response(buildAuthorizedMdfeResponse(), { status: 200 })

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      mdfeData: buildMdfeData(),
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    expect(result.success).toBe(true)
    expect(result.chaveAcesso).toBe(MOCK_ACCESS_KEY)
    expect(result.protocolo).toBe('135260000000001')
    expect(result.serie).toBe('1')
    expect(result.numeroDocumento).toBe(1)

    const xmlAutorizado = result.xmlAutorizado ?? ''
    expect(xmlAutorizado.includes('<mdfeProc versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">')).toBe(true)
    expect(xmlAutorizado.includes('<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">')).toBe(true)
    expect(xmlAutorizado.includes('<protMDFe')).toBe(true)
    expect(xmlAutorizado.includes('</mdfeProc>')).toBe(true)
  })

  test('surfaces the SEFAZ cStat and xMotivo when retMDFe rejects the MDF-e', async () => {
    const certificateFixture = createCertificateFixture()

    globalThis.fetch = async (): Promise<Response> => new Response(buildRejectedMdfeResponse(), { status: 200 })

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.emit({
      referenceId: 'mdfe-wire-contract-test',
      config,
      mdfeData: buildMdfeData(),
      items: [],
      payments: [],
      totalAmount: 0,
      discountAmount: 0,
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('215')
    expect(result.errorMessage).toContain('Falha no schema XML')
    expect(result.xmlAutorizado).toBeUndefined()
  })
})

describe('MDFeStatusServico', () => {
  test('consults the SVRS status service with the mdfeStatusServicoMDF action', async () => {
    const certificateFixture = createCertificateFixture()
    let requestUrl = ''
    let soapAction = ''
    let requestBody = ''

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestUrl = String(input)
      soapAction = new Headers(init?.headers).get('SOAPAction') ?? ''
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(buildStatusServicoResponse(), { status: 200 })
    }

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.testConnection({ config })

    expect(result.ok).toBe(true)
    expect(requestUrl).toBe('https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx')
    expect(soapAction).toBe('"http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico/mdfeStatusServicoMDF"')
    // consStatServMDFe aceita só tpAmb e xServ — com cUF a SVRS rejeita com cStat 215.
    // É onde o MDF-e diverge da NF-e e do CT-e: autorizador nacional único não pede UF.
    expect(
      requestBody.includes(
        '<consStatServMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe"><tpAmb>2</tpAmb><xServ>STATUS</xServ></consStatServMDFe>',
      ),
    ).toBe(true)
    expect(requestBody.includes('<cUF>')).toBe(false)
  })
})

// O formato dos eventos 110111 e 110112 está fixado em mdfe-evento-wire.contract.test.ts
describe('MDF-e cancelamento pela factory', () => {
  test('transmite o evento 110111 pelo MDFeRecepcaoEvento', async () => {
    const certificateFixture = createCertificateFixture()
    let requestUrl = ''

    globalThis.fetch = async (input: string | URL | Request): Promise<Response> => {
      requestUrl = String(input)
      return new Response(buildCancelamentoRegistradoResponse(), { status: 200 })
    }

    const config = buildMdfeConfig(certificateFixture.pfxBase64)
    const provider = createFiscalProvider(config)
    const result = await provider.cancel({
      config,
      chaveAcesso: MOCK_ACCESS_KEY,
      protocolo: '135260000000001',
      justificativa: 'Cancelamento por erro de rota no manifesto emitido',
    })

    expect(result.success).toBe(true)
    expect(requestUrl).toBe('https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx')
    expect(result.xmlEvento?.includes('<procEventoMDFe versao="3.00"')).toBe(true)
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

function buildMdfeData(): MdfeData {
  return {
    tipoEmitente: '1',
    tipoTransportador: '1',
    ufInicio: 'SP',
    ufFim: 'RJ',
    municipiosCarregamento: [{ codigo: '3550308', nome: 'Sao Paulo' }],
    municipiosDescarga: [
      {
        codigo: '3304557',
        nome: 'Rio de Janeiro',
        chavesCte: [MOCK_CTE_KEY],
        chavesNfe: [MOCK_NFE_KEY],
      },
    ],
    produtoPredominante: { tipoCarga: '05', descricao: 'CARGA GERAL' },
    totais: { vCarga: 5000, cUnid: '01', qCarga: 100 },
    rntrc: '12345678',
    veiculoTracao: {
      codigoInterno: '1',
      placa: 'ABC1D23',
      renavam: '12345678901',
      tara: 7500,
      capacidadeKg: 25000,
      tipoRodado: '03',
      tipoCarroceria: '02',
      uf: 'SP',
      condutores: [{ nome: 'MOTORISTA TESTE', cpf: '12345678909' }],
    },
    informacoesAdicionais: 'MANIFESTO DE TESTE',
  }
}

// Formato devolvido por mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx
function buildAuthorizedMdfeResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><mdfeResultMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc">',
    '<retMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">',
    '<tpAmb>2</tpAmb><cUF>43</cUF><verAplic>SVRS-MDFe-3.00</verAplic>',
    '<cStat>100</cStat><xMotivo>Autorizado o uso do MDF-e</xMotivo>',
    '<protMDFe versao="3.00"><infProt><tpAmb>2</tpAmb><verAplic>SVRS-MDFe-3.00</verAplic>',
    `<chMDFe>${MOCK_ACCESS_KEY}</chMDFe><dhRecbto>2026-07-28T09:41:12-03:00</dhRecbto>`,
    '<nProt>135260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado o uso do MDF-e</xMotivo>',
    '</infProt></protMDFe></retMDFe></mdfeResultMsg></soap:Body></soap:Envelope>',
  ].join('')
}

function buildRejectedMdfeResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><mdfeResultMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc">',
    '<retMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">',
    '<tpAmb>2</tpAmb><cUF>43</cUF><verAplic>SVRS-MDFe-3.00</verAplic>',
    '<cStat>215</cStat>',
    "<xMotivo>Rejeição: Falha no schema XML [Detalhes: The required attribute 'versaoModal' is missing.].</xMotivo>",
    '</retMDFe></mdfeResultMsg></soap:Body></soap:Envelope>',
  ].join('')
}

function buildCancelamentoRegistradoResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><mdfeResultMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento">',
    '<retEventoMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">',
    '<infEvento><tpAmb>2</tpAmb><verAplic>SVRS-MDFe-3.00</verAplic><cOrgao>35</cOrgao>',
    '<cStat>135</cStat><xMotivo>Evento registrado e vinculado a MDF-e</xMotivo>',
    `<chMDFe>${MOCK_ACCESS_KEY}</chMDFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento>`,
    '<dhRegEvento>2026-07-28T18:12:44-03:00</dhRegEvento><nProt>135260000000003</nProt>',
    '</infEvento></retEventoMDFe></mdfeResultMsg></soap:Body></soap:Envelope>',
  ].join('')
}

function buildStatusServicoResponse(): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">',
    '<soap:Body><mdfeResultMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico">',
    '<retConsStatServMDFe versao="3.00" xmlns="http://www.portalfiscal.inf.br/mdfe">',
    '<tpAmb>2</tpAmb><verAplic>SVRS-MDFe-3.00</verAplic><cStat>107</cStat>',
    '<xMotivo>Servico em Operacao</xMotivo><cUF>43</cUF>',
    '<dhRecbto>2026-07-28T09:41:12-03:00</dhRecbto><tMed>1</tMed>',
    '</retConsStatServMDFe></mdfeResultMsg></soap:Body></soap:Envelope>',
  ].join('')
}
