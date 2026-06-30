import type { FiscalProvider } from '../FiscalProvider.interface'
import type {
  EmitFiscalParams,
  CancelFiscalParams,
  TestConnectionParams,
  FiscalResult,
  TestConnectionResult,
  NotaRpConfig,
  NotaRpNfseData,
} from '../types'
import { FiscalError, FiscalConnectionError, FiscalRejectionError } from '../errors/FiscalError'

const NOTARP_BASE_URL = 'https://www.notarp.com.br'

type NotaRpEmitirPayload = {
  tomador: {
    documento?: string
    nome?: string
    email?: string
    telefone?: string
    pais: string
    cep?: string
    estado?: string
    cidade?: string
    bairro?: string
    endereco?: string
    numero?: string
  }
  servico: {
    descricao: string
    valor_total: number
    codigo_tributacao_nacional: string
    codigo_tributacao_municipal: string
    codigo_nbs: string
    data_competencia: string
    pais: string
    municipio: string
    incidencia_issqn: string
    aliquota_issqn: number
    issqn_retido: boolean
    regime_especial_tributacao: string
    informacoes_complementares?: string
    desconto_incondicionado: number
    desconto_condicionado: number
    cst_pis_cofins: string
    aliquota_pis: number
    aliquota_cofins: number
    pis_retido: boolean
    cofins_retido: boolean
    tributos_aproximados?: { aliquota_simples_nacional: number }
    ibscbs?: { cst: string; classtrib: string; indop: string }
  }
  flags: {
    hash_pedido?: string
    webhook_url?: string
    enviar_email: boolean
  }
}

type NotaRpCancelarPayload = {
  id_nota: number
  motivo: string
  descricao: string
  enviar_email: boolean
  email?: string
}

type NotaRpEmitirResponse = {
  sucesso: boolean
  mensagem?: string
  id_nota?: number
  numero_nota?: string
  serie?: string
  status?: string
  erros?: string[]
}

type NotaRpCancelarResponse = {
  sucesso: boolean
  mensagem?: string
  erros?: string[]
}

type NotaRpEmpresaListarResponse = {
  sucesso: boolean
  mensagem?: string
  empresas?: unknown[]
}

function buildHeaders(config: NotaRpConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Auth-User-Token': config.apiToken,
    'X-Auth-CNPJ': config.cnpj.replace(/\D/g, ''),
    'X-Auth-IM': config.inscricaoMunicipal.replace(/\D/g, ''),
  }
}

function resolveBaseUrl(config: NotaRpConfig): string {
  return config.baseUrl ?? NOTARP_BASE_URL
}

function buildEmitirPayload(data: NotaRpNfseData): NotaRpEmitirPayload {
  return {
    tomador: {
      documento: data.tomador?.documento,
      nome: data.tomador?.nome,
      email: data.tomador?.email,
      telefone: data.tomador?.telefone,
      pais: data.tomador?.pais ?? 'BR',
      cep: data.tomador?.cep,
      estado: data.tomador?.estado,
      cidade: data.tomador?.cidade,
      bairro: data.tomador?.bairro,
      endereco: data.tomador?.endereco,
      numero: data.tomador?.numero,
    },
    servico: {
      descricao: data.descricao,
      valor_total: data.valorTotal,
      codigo_tributacao_nacional: data.codigoTributacaoNacional,
      codigo_tributacao_municipal: data.codigoTributacaoMunicipal,
      codigo_nbs: data.codigoNbs,
      data_competencia: data.dataCompetencia,
      pais: 'BR',
      municipio: data.municipio,
      incidencia_issqn: data.incidenciaIssqn ?? 'operacao_tributavel',
      aliquota_issqn: data.aliquotaIssqn,
      issqn_retido: data.issqnRetido ?? false,
      regime_especial_tributacao: data.regimeEspecialTributacao ?? 'nenhum',
      informacoes_complementares: data.informacoesComplementares,
      desconto_incondicionado: data.descontoIncondicionado ?? 0,
      desconto_condicionado: data.descontoCondicionado ?? 0,
      cst_pis_cofins: data.cstPisCofins ?? 'aliquota_basica',
      aliquota_pis: data.aliquotaPis ?? 0.65,
      aliquota_cofins: data.aliquotaCofins ?? 3.0,
      pis_retido: data.pisRetido ?? false,
      cofins_retido: data.cofinsRetido ?? false,
      tributos_aproximados: data.aliquotaSimplesNacional !== undefined
        ? { aliquota_simples_nacional: data.aliquotaSimplesNacional }
        : undefined,
      ibscbs: data.ibscbs,
    },
    flags: {
      hash_pedido: data.hashPedido,
      webhook_url: data.webhookUrl,
      enviar_email: data.enviarEmail ?? false,
    },
  }
}

async function doRequest<TResponse>(
  url: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  body?: unknown,
): Promise<TResponse> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkError) {
    throw new FiscalConnectionError('NotaRP', (networkError as Error).message)
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    const text = await response.text().catch(() => '')
    throw new FiscalError(
      `NotaRP retornou resposta inválida (HTTP ${response.status}): ${text.slice(0, 200)}`,
      'INVALID_RESPONSE',
      url,
      { status: response.status, body: text },
    )
  }

  return json as TResponse
}

export class NotaRpNfseProvider implements FiscalProvider {
  async emit(params: EmitFiscalParams): Promise<FiscalResult> {
    const config = params.config as NotaRpConfig
    const data = params.notaRpNfseData

    if (!data) {
      return {
        success: false,
        errorCode: 'MISSING_NOTA_RP_DATA',
        errorMessage: 'notaRpNfseData é obrigatório para emitir NFS-e via NotaRP',
        rawResponse: null,
      }
    }

    const url = `${resolveBaseUrl(config)}/api/v3/nota/emitir`
    const payload = buildEmitirPayload(data)
    const result = await doRequest<NotaRpEmitirResponse>(url, 'POST', buildHeaders(config), payload)

    if (!result.sucesso) {
      const mensagem = result.mensagem ?? result.erros?.join('; ') ?? 'Erro desconhecido na emissão'
      throw new FiscalRejectionError('NOTARP_REJECT', mensagem, result)
    }

    return {
      success: true,
      chaveAcesso: String(result.id_nota ?? ''),
      numeroDocumento: result.id_nota,
      serie: result.serie,
      rawResponse: result,
    }
  }

  async cancel(params: CancelFiscalParams): Promise<FiscalResult> {
    const config = params.config as NotaRpConfig

    const idNota = Number(params.chaveAcesso)
    if (Number.isNaN(idNota)) {
      return {
        success: false,
        errorCode: 'INVALID_NOTA_ID',
        errorMessage: `chaveAcesso deve ser o id_nota numérico retornado pela emissão — recebido: "${params.chaveAcesso}"`,
        rawResponse: null,
      }
    }

    const url = `${resolveBaseUrl(config)}/api/v3/nota/cancelar`
    const payload: NotaRpCancelarPayload = {
      id_nota: idNota,
      motivo: 'outros',
      descricao: params.justificativa,
      enviar_email: false,
    }

    const result = await doRequest<NotaRpCancelarResponse>(url, 'POST', buildHeaders(config), payload)

    if (!result.sucesso) {
      const mensagem = result.mensagem ?? result.erros?.join('; ') ?? 'Erro desconhecido no cancelamento'
      throw new FiscalRejectionError('NOTARP_CANCEL_REJECT', mensagem, result)
    }

    return {
      success: true,
      chaveAcesso: params.chaveAcesso,
      rawResponse: result,
    }
  }

  async testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const config = params.config as NotaRpConfig

    const url = `${resolveBaseUrl(config)}/api/v3/empresa/listar`
    let result: NotaRpEmpresaListarResponse

    try {
      result = await doRequest<NotaRpEmpresaListarResponse>(url, 'GET', buildHeaders(config))
    } catch (error) {
      if (error instanceof FiscalConnectionError) {
        return { ok: false, message: error.message }
      }
      return { ok: false, message: String(error) }
    }

    if (!result.sucesso) {
      return {
        ok: false,
        message: result.mensagem ?? 'Autenticação rejeitada pelo NotaRP — verifique apiToken, CNPJ e inscrição municipal',
      }
    }

    return { ok: true, message: 'Conexão com NotaRP OK' }
  }
}
