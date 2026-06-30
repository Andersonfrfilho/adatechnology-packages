import { XMLParser } from 'fast-xml-parser'
import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  NfseConfig,
  NfseData,
  NfseCancelCode,
} from '../types'
import { loadCertificate, signNfceXml } from '../sefaz/SefazXmlSigner'
import { FiscalError, FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'

const REQUEST_TIMEOUT_MS = 30_000

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
})

export class NfseProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const config = params.config as NfseConfig

    if (!params.nfseData) {
      return {
        success: false,
        errorCode: 'MISSING_NFSE_DATA',
        errorMessage: 'nfseData é obrigatório para emissão de NFS-e (discriminacao, competencia)',
        rawResponse: null,
      }
    }

    const certData = loadCertificateOrThrow(config)
    const rpsNumero = String(Date.now()).slice(-9)

    if (params.nfseData.nfseSubstituida) {
      return this.substituirNfse({ params, config, rpsNumero, certData })
    }

    const xml = buildGerarNfseXml({ params, config, rpsNumero })
    const signedXml = signOrThrow(xml, certData, 'NFS-e')

    const soapBody = buildGerarNfseSoap(signedXml)
    const responseText = await sendSoap({
      url: config.webserviceUrl,
      soapAction: 'http://www.abrasf.org.br/nfse.xsd/RecepcionarLoteRpsSincrono',
      body: soapBody,
      certData,
    })

    return parseGerarNfseResponse(responseText)
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const config = params.config as NfseConfig

    if (!params.justificativa || params.justificativa.trim().length < 15) {
      return {
        success: false,
        errorCode: 'INVALID_JUSTIFICATIVA',
        errorMessage: `justificativa muito curta: mínimo 15 caracteres (recebido: ${params.justificativa?.trim().length ?? 0})`,
        rawResponse: null,
      }
    }

    const certData = loadCertificateOrThrow(config)
    const codigoCancelamento = params.codigoCancelamento ?? '1'
    const xml = buildCancelarNfseXml({ config, numeroNfse: params.chaveAcesso, codigoCancelamento })
    const signedXml = signOrThrow(xml, certData, 'cancelamento NFS-e')

    const soapBody = buildCancelarNfseSoap(signedXml)
    const responseText = await sendSoap({
      url: config.webserviceUrl,
      soapAction: 'http://www.abrasf.org.br/nfse.xsd/CancelarNfse',
      body: soapBody,
      certData,
    })

    return parseCancelarNfseResponse(responseText)
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const config = params.config as NfseConfig

    try {
      loadCertificateOrThrow(config)
    } catch (error) {
      return {
        ok: false,
        message: `Certificado inválido: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      }
    }

    try {
      const response = await fetchWithTimeout(config.webserviceUrl, { method: 'GET' })
      return {
        ok: response.ok || response.status < 500,
        message: `Webservice municipal respondeu HTTP ${response.status}`,
      }
    } catch (error) {
      if (error instanceof FiscalTimeoutError) {
        return { ok: false, message: 'Webservice municipal não respondeu em 30s — verifique a URL' }
      }
      if (error instanceof FiscalConnectionError) {
        return { ok: false, message: `Erro de conexão: ${error.providerMessage}` }
      }
      return { ok: false, message: 'Erro inesperado ao testar conexão NFS-e' }
    }
  }

  private async substituirNfse({
    params,
    config,
    rpsNumero,
    certData,
  }: SubstituirNfseInternalParams): Promise<FiscalResult> {
    const nfseSubstituida = params.nfseData!.nfseSubstituida!
    const xml = buildSubstituirNfseXml({ params, config, rpsNumero, nfseSubstituida })
    const signedXml = signOrThrow(xml, certData, 'substituição NFS-e')

    const soapBody = buildSubstituirNfseSoap(signedXml)
    const responseText = await sendSoap({
      url: config.webserviceUrl,
      soapAction: 'http://www.abrasf.org.br/nfse.xsd/SubstituirNfse',
      body: soapBody,
      certData,
    })

    return parseSubstituirNfseResponse(responseText)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildGerarNfseXmlParams = {
  readonly params: EmitFiscalParams
  readonly config: NfseConfig
  readonly rpsNumero: string
}

type SubstituirNfseInternalParams = {
  readonly params: EmitFiscalParams
  readonly config: NfseConfig
  readonly rpsNumero: string
  readonly certData: { certificatePem: string; privateKeyPem: string }
}

type BuildSubstituirNfseXmlParams = {
  readonly params: EmitFiscalParams
  readonly config: NfseConfig
  readonly rpsNumero: string
  readonly nfseSubstituida: string
}

// ─── XML Builders ─────────────────────────────────────────────────────────────

function buildGerarNfseXml({ params, config, rpsNumero }: BuildGerarNfseXmlParams): string {
  const nfseData = params.nfseData as NfseData
  return `<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <RPS>
    ${buildInfDeclaracaoXml({ params, config, rpsNumero, nfseData })}
  </RPS>
</GerarNfseEnvio>`
}

function buildSubstituirNfseXml({
  params,
  config,
  rpsNumero,
  nfseSubstituida,
}: BuildSubstituirNfseXmlParams): string {
  const nfseData = params.nfseData as NfseData
  const cnpjLimpo = config.cnpj.replace(/\D/g, '')

  return `<?xml version="1.0" encoding="UTF-8"?>
<SubstituirNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <SubstituicaoNfse Id="Sub${rpsNumero}">
    <Pedido>
      <InfPedidoCancelamento Id="Cancel${nfseSubstituida}">
        <IdentificacaoNfse>
          <Numero>${nfseSubstituida}</Numero>
          <CpfCnpj><Cnpj>${cnpjLimpo}</Cnpj></CpfCnpj>
          <InscricaoMunicipal>${config.inscricaoMunicipal}</InscricaoMunicipal>
          <CodigoMunicipio>${config.codigoMunicipio}</CodigoMunicipio>
        </IdentificacaoNfse>
        <CodigoCancelamento>4</CodigoCancelamento>
      </InfPedidoCancelamento>
    </Pedido>
    <RPS>
      ${buildInfDeclaracaoXml({ params, config, rpsNumero, nfseData })}
    </RPS>
  </SubstituicaoNfse>
</SubstituirNfseEnvio>`
}

type BuildInfDeclaracaoParams = {
  readonly params: EmitFiscalParams
  readonly config: NfseConfig
  readonly rpsNumero: string
  readonly nfseData: NfseData
}

function buildInfDeclaracaoXml({ params, config, rpsNumero, nfseData }: BuildInfDeclaracaoParams): string {
  const dataEmissao = new Date().toISOString().slice(0, 10)
  const competencia = `${nfseData.competencia}-01`
  const valorServicos = params.totalAmount.toFixed(2)
  const valorIss = ((params.totalAmount * config.aliquotaIss) / 100).toFixed(2)
  const issRetidoCodigo = config.issRetido ? '1' : '2'
  const tomadorXml = buildTomadorXml(nfseData)

  return `<InfDeclaracaoPrestacaoServico Id="Rps${rpsNumero}">
      <Rps>
        <IdentificacaoRps>
          <Numero>${rpsNumero}</Numero>
          <Serie>RPS</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${dataEmissao}</DataEmissao>
        <Status>1</Status>
      </Rps>
      <Competencia>${competencia}</Competencia>
      <Servico>
        <Valores>
          <ValorServicos>${valorServicos}</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>0.00</ValorPis>
          <ValorCofins>0.00</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>0.00</ValorIr>
          <ValorCsll>0.00</ValorCsll>
          <IssRetido>${issRetidoCodigo}</IssRetido>
          <ValorIss>${valorIss}</ValorIss>
          <ValorIssRetido>${config.issRetido ? valorIss : '0.00'}</ValorIssRetido>
          <OutrasRetencoes>0.00</OutrasRetencoes>
          <BaseCalculo>${valorServicos}</BaseCalculo>
          <Aliquota>${config.aliquotaIss.toFixed(2)}</Aliquota>
          <ValorLiquidoNfse>${params.totalAmount.toFixed(2)}</ValorLiquidoNfse>
        </Valores>
        <ItemListaServico>${config.codigoServico}</ItemListaServico>
        <Discriminacao>${escapeXml(nfseData.discriminacao)}</Discriminacao>
        <CodigoMunicipio>${config.codigoMunicipio}</CodigoMunicipio>
        <CodigoPais>1058</CodigoPais>
        <ExigibilidadeISS>1</ExigibilidadeISS>
        <MunicipioIncidencia>${config.codigoMunicipio}</MunicipioIncidencia>
      </Servico>
      <Prestador>
        <CpfCnpj><Cnpj>${config.cnpj.replace(/\D/g, '')}</Cnpj></CpfCnpj>
        <InscricaoMunicipal>${config.inscricaoMunicipal}</InscricaoMunicipal>
      </Prestador>
      ${tomadorXml}
      <OptanteSimplesNacional>${config.crt === '1' ? '1' : '2'}</OptanteSimplesNacional>
      <IncentivoFiscal>2</IncentivoFiscal>
    </InfDeclaracaoPrestacaoServico>`
}

function buildTomadorXml(nfseData: NfseData): string {
  if (!nfseData.tomadorCnpj && !nfseData.tomadorCpf) return ''

  const cpfCnpjXml = nfseData.tomadorCnpj
    ? `<Cnpj>${nfseData.tomadorCnpj.replace(/\D/g, '')}</Cnpj>`
    : `<Cpf>${nfseData.tomadorCpf!.replace(/\D/g, '')}</Cpf>`

  const inscricaoXml = nfseData.tomadorInscricaoMunicipal
    ? `<InscricaoMunicipal>${nfseData.tomadorInscricaoMunicipal}</InscricaoMunicipal>`
    : ''

  return `<Tomador>
      <IdentificacaoTomador>
        <CpfCnpj>${cpfCnpjXml}</CpfCnpj>
        ${inscricaoXml}
      </IdentificacaoTomador>
      ${nfseData.tomadorRazaoSocial ? `<RazaoSocial>${escapeXml(nfseData.tomadorRazaoSocial)}</RazaoSocial>` : ''}
      ${nfseData.tomadorEmail ? `<Contato><Email>${nfseData.tomadorEmail}</Email></Contato>` : ''}
    </Tomador>`
}

function buildCancelarNfseXml({
  config,
  numeroNfse,
  codigoCancelamento,
}: {
  config: NfseConfig
  numeroNfse: string
  codigoCancelamento: NfseCancelCode
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Pedido>
    <InfPedidoCancelamento Id="Cancel${numeroNfse}">
      <IdentificacaoNfse>
        <Numero>${numeroNfse}</Numero>
        <CpfCnpj><Cnpj>${config.cnpj.replace(/\D/g, '')}</Cnpj></CpfCnpj>
        <InscricaoMunicipal>${config.inscricaoMunicipal}</InscricaoMunicipal>
        <CodigoMunicipio>${config.codigoMunicipio}</CodigoMunicipio>
      </IdentificacaoNfse>
      <CodigoCancelamento>${codigoCancelamento}</CodigoCancelamento>
    </InfPedidoCancelamento>
  </Pedido>
</CancelarNfseEnvio>`
}

// ─── SOAP Envelopes ───────────────────────────────────────────────────────────

function buildGerarNfseSoap(innerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <RecepcionarLoteRpsSincrono xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${innerXml}
    </RecepcionarLoteRpsSincrono>
  </soap12:Body>
</soap12:Envelope>`
}

function buildSubstituirNfseSoap(innerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <SubstituirNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${innerXml}
    </SubstituirNfse>
  </soap12:Body>
</soap12:Envelope>`
}

function buildCancelarNfseSoap(innerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <CancelarNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
      ${innerXml}
    </CancelarNfse>
  </soap12:Body>
</soap12:Envelope>`
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseGerarNfseResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retorno = body?.RecepcionarLoteRpsSincronoResposta ?? body?.GerarNfseResposta

    const nfse = retorno?.ListaNfse?.CompNfse?.Nfse?.InfNfse
    if (nfse) {
      return {
        success: true,
        chaveAcesso: String(nfse.CodigoVerificacao ?? ''),
        numeroDocumento: nfse.Numero ? parseInt(String(nfse.Numero), 10) : undefined,
        rawResponse: retorno,
      }
    }

    const listaErros =
      retorno?.ListaMensagemRetorno?.MensagemRetorno ??
      retorno?.ListaMensagemRetornoLote?.MensagemRetorno
    const primeiroErro = Array.isArray(listaErros) ? listaErros[0] : listaErros

    if (primeiroErro) {
      return {
        success: false,
        errorCode: String(primeiroErro.Codigo ?? 'NFSE_ERROR'),
        errorMessage: String(primeiroErro.Mensagem ?? 'Município rejeitou a NFS-e'),
        rawResponse: retorno,
      }
    }

    return {
      success: false,
      errorCode: 'NFSE_PARSE_ERROR',
      errorMessage: `Resposta inesperada do município — sem NFS-e nem erro. Primeiros 300 chars: ${soapXml.slice(0, 300)}`,
      rawResponse: soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'NFSE_PARSE_ERROR',
      errorMessage: `Falha ao interpretar resposta NFS-e: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

function parseCancelarNfseResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retorno = body?.CancelarNfseResposta

    const cancelamento = retorno?.RetCancelamento?.NfseCancelamento
    if (cancelamento) {
      return { success: true, rawResponse: retorno }
    }

    const listaErros = retorno?.ListaMensagemRetorno?.MensagemRetorno
    const primeiroErro = Array.isArray(listaErros) ? listaErros[0] : listaErros

    if (primeiroErro) {
      return {
        success: false,
        errorCode: String(primeiroErro.Codigo ?? 'CANCEL_ERROR'),
        errorMessage: String(primeiroErro.Mensagem ?? 'Município rejeitou o cancelamento'),
        rawResponse: retorno,
      }
    }

    return {
      success: false,
      errorCode: 'NFSE_CANCEL_PARSE_ERROR',
      errorMessage: `Resposta inesperada do cancelamento. Primeiros 300 chars: ${soapXml.slice(0, 300)}`,
      rawResponse: soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'NFSE_CANCEL_PARSE_ERROR',
      errorMessage: `Falha ao interpretar resposta de cancelamento: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

function parseSubstituirNfseResponse(soapXml: string): FiscalResult {
  try {
    const parsed = XML_PARSER.parse(soapXml)
    const body = parsed?.Envelope?.Body
    const retorno = body?.SubstituirNfseResposta

    const nfse =
      retorno?.RetSubstituicao?.NfseSubstituicao?.SubstituicaoNfse?.NfseSubstituida?.CompNfse?.Nfse?.InfNfse

    if (nfse) {
      return {
        success: true,
        chaveAcesso: String(nfse.CodigoVerificacao ?? ''),
        numeroDocumento: nfse.Numero ? parseInt(String(nfse.Numero), 10) : undefined,
        rawResponse: retorno,
      }
    }

    const listaErros = retorno?.ListaMensagemRetorno?.MensagemRetorno
    const primeiroErro = Array.isArray(listaErros) ? listaErros[0] : listaErros

    if (primeiroErro) {
      return {
        success: false,
        errorCode: String(primeiroErro.Codigo ?? 'SUBSTITUICAO_ERROR'),
        errorMessage: String(primeiroErro.Mensagem ?? 'Município rejeitou a substituição da NFS-e'),
        rawResponse: retorno,
      }
    }

    return {
      success: false,
      errorCode: 'NFSE_SUBSTITUICAO_PARSE_ERROR',
      errorMessage: `Resposta inesperada da substituição. Primeiros 300 chars: ${soapXml.slice(0, 300)}`,
      rawResponse: soapXml,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'NFSE_SUBSTITUICAO_PARSE_ERROR',
      errorMessage: `Falha ao interpretar resposta de substituição: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      rawResponse: soapXml,
    }
  }
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

type SendSoapParams = {
  readonly url: string
  readonly soapAction: string
  readonly body: string
  readonly certData: { certificatePem: string; privateKeyPem: string }
}

async function sendSoap({ url, soapAction, body, certData }: SendSoapParams): Promise<string> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': `"${soapAction}"`,
    },
    body,
    // @ts-expect-error — Bun TLS extension
    tls: {
      cert: certData.certificatePem,
      key: certData.privateKeyPem,
      rejectUnauthorized: false,
    },
  })
  return response.text()
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FiscalTimeoutError('webservice municipal NFS-e')
    }
    throw new FiscalConnectionError(
      'webservice municipal NFS-e',
      error instanceof Error ? error.message : 'erro de rede desconhecido'
    )
  } finally {
    clearTimeout(timer)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadCertificateOrThrow(config: NfseConfig) {
  return loadCertificate(config.certificadoBase64, config.certificadoSenha)
}

function signOrThrow(
  xml: string,
  certData: { certificatePem: string; privateKeyPem: string },
  context: string
): string {
  try {
    const result = signNfceXml(xml, certData)
    return result.signedXml
  } catch (error) {
    throw new FiscalError(
      `Falha ao assinar XML de ${context}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null
    )
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
