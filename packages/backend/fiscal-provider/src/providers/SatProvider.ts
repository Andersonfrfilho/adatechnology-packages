import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  SatConfig,
} from '../types'
import { toSatPaymentCode } from '../utils/mapPaymentMethod'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'
import { buildCupomPdf } from '../danfce/CupomPdfBuilder'
import { gerarURLQRCode } from './controlid-qrcode'

const REQUEST_TIMEOUT_MS = 10_000

type SatStatusResponse = {
  EEEEE: string
  mensagem: string
  men_sefaz: string
}

type SatEmitResponse = {
  EEEEE: string
  mensagem: string
  xml_enviado?: string
  xml_retorno?: string
  numero_sessao?: string
  chave_nfe?: string
  numero_nota?: string
  serie?: string
}

type SatCancelResponse = {
  EEEEE: string
  mensagem: string
  xml_retorno?: string
}

const SAT_OK_CODE = '06000'

export class SatProvider implements FiscalProvider {
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FiscalTimeoutError('SAT')
      }
      throw new FiscalConnectionError(
        'SAT',
        error instanceof Error ? error.message : 'Verifique se o equipamento SAT está ligado e acessível',
      )
    } finally {
      clearTimeout(timer)
    }
  }

  private buildCfeXml(params: EmitFiscalParams, config: SatConfig): string {
    const items = params.items
      .map(
        (item, index) =>
          `<det itemNot="${index + 1}">
          <prod>
            <cProd>${item.codigo}</cProd>
            <xProd>${this.escapeXml(item.descricao)}</xProd>
            <NCM>${item.ncm}</NCM>
            <CFOP>${item.cfop}</CFOP>
            <uCom>${item.unidade}</uCom>
            <qCom>${item.quantidade.toFixed(4)}</qCom>
            <vUnCom>${item.valorUnitario.toFixed(2)}</vUnCom>
            <indRegra>A</indRegra>
          </prod>
          <imposto>
            <ICMS>
              <ICMSSN102>
                <Orig>0</Orig>
                <CSOSN>500</CSOSN>
              </ICMSSN102>
            </ICMS>
            <PIS>
              <PISNT><CST>07</CST></PISNT>
            </PIS>
            <COFINS>
              <COFINSNT><CST>07</CST></COFINSNT>
            </COFINS>
          </imposto>
        </det>`,
      )
      .join('\n')

    const payments = params.payments
      .map(
        (payment) =>
          `<MP>
          <cMP>${toSatPaymentCode(payment.method)}</cMP>
          <vMP>${payment.amount.toFixed(2)}</vMP>
        </MP>`,
      )
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<CFe>
  <infCFe versaoDadosEnt="0.08">
    <ide>
      <CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ>
      <signAC>${config.signatureAC}</signAC>
      <numeroCaixa>001</numeroCaixa>
    </ide>
    <emit>
      <CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ>
      <IE>${config.inscricaoEstadual}</IE>
      <indRatISSQN>N</indRatISSQN>
    </emit>
    ${items}
    <total/>
    <pgto>
      ${payments}
    </pgto>
  </infCFe>
</CFe>`
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private extractChaveAcesso(xmlRetorno: string): string | undefined {
    const match = xmlRetorno.match(/<chaveConsulta>([^<]+)<\/chaveConsulta>/)
    return match?.[1]
  }

  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const config = params.config as SatConfig
    const xml = this.buildCfeXml(params, config)

    const body = new URLSearchParams({
      numeroSessao: Date.now().toString().slice(-6),
      codigoDeAtivacao: config.activationCode,
      dadosVenda: xml,
    })

    const response = await this.fetchWithTimeout(`${config.satUrl}/SAT/ComunicarUnsignedSaleData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const raw = (await response.json()) as SatEmitResponse

    if (raw.EEEEE === SAT_OK_CODE && raw.xml_retorno) {
      const chaveAcesso = raw.chave_nfe ?? this.extractChaveAcesso(raw.xml_retorno)
      const dataEmissao = new Date()
      const fiscalResult: FiscalResult = {
        success: true,
        chaveAcesso,
        numeroDocumento: raw.numero_nota ? parseInt(raw.numero_nota, 10) : undefined,
        serie: raw.serie,
        xmlAutorizado: raw.xml_retorno,
        rawResponse: raw,
      }

      const qrCodeUrl = chaveAcesso
        ? gerarURLQRCode({
            chaveAcesso,
            cnpj: config.cnpj,
            dataEmissao: `${String(dataEmissao.getDate()).padStart(2, '0')}${String(dataEmissao.getMonth() + 1).padStart(2, '0')}${String(dataEmissao.getFullYear()).slice(-2)}`,
            valorTotal: params.totalAmount.toFixed(2),
            ambiente: config.environment === 'producao' ? '1' : '2',
          })
        : `CHAVE:${chaveAcesso ?? 'SEM_CHAVE'}`

      const cupomPdf = await buildCupomPdf({
        emitParams: params,
        config,
        result: fiscalResult,
        qrCodePayload: qrCodeUrl,
        urlConsulta: 'https://satsp.fazenda.sp.gov.br/COMSAT/Public/ConsultaPublica/ConsultaPublicaCfe.aspx',
        dataEmissao,
        documentLabel: 'CUPOM FISCAL ELETRÔNICO — SAT (CF-e)',
      })

      return { ...fiscalResult, qrCodeUrl, cupomPdf }
    }

    return {
      success: false,
      errorCode: raw.EEEEE,
      errorMessage: raw.mensagem ?? `SAT retornou código ${raw.EEEEE}`,
      rawResponse: raw,
    }
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const config = params.config as SatConfig

    if (params.justificativa.trim().length < 15) {
      return {
        success: false,
        errorCode: 'INVALID_JUSTIFICATIVA',
        errorMessage: 'A justificativa deve ter no mínimo 15 caracteres',
        rawResponse: null,
      }
    }

    const body = new URLSearchParams({
      numeroSessao: Date.now().toString().slice(-6),
      codigoDeAtivacao: config.activationCode,
      chaveEnvio: params.chaveAcesso,
      justificativa: params.justificativa,
    })

    const response = await this.fetchWithTimeout(`${config.satUrl}/SAT/CancelarUltimaVenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const raw = (await response.json()) as SatCancelResponse

    if (raw.EEEEE === SAT_OK_CODE) {
      return {
        success: true,
        xmlAutorizado: raw.xml_retorno,
        rawResponse: raw,
      }
    }

    return {
      success: false,
      errorCode: raw.EEEEE,
      errorMessage: raw.mensagem ?? `SAT retornou código ${raw.EEEEE}`,
      rawResponse: raw,
    }
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const config = params.config as SatConfig

    try {
      const body = new URLSearchParams({
        numeroSessao: '000001',
        codigoDeAtivacao: config.activationCode,
      })

      const response = await this.fetchWithTimeout(`${config.satUrl}/SAT/ConsultarSAT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      const raw = (await response.json()) as SatStatusResponse

      if (raw.EEEEE === SAT_OK_CODE) {
        return { ok: true, message: `SAT respondeu OK: ${raw.mensagem}` }
      }

      return {
        ok: false,
        message: `SAT retornou código ${raw.EEEEE}: ${raw.mensagem}`,
      }
    } catch (error) {
      if (error instanceof FiscalTimeoutError) {
        return { ok: false, message: 'SAT não respondeu — verifique se está ligado e na URL correta' }
      }
      if (error instanceof FiscalConnectionError) {
        return { ok: false, message: `Erro de conexão com SAT: ${error.providerMessage}` }
      }
      return { ok: false, message: 'Erro inesperado ao testar SAT' }
    }
  }
}
