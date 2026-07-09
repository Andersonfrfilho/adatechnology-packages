import { Injectable, BadRequestException } from '@nestjs/common'
import {
  createFiscalProvider,
  type FiscalConfig,
  type FiscalProvider,
  type EmitFiscalParams,
  type CancelFiscalParams,
  validateCertificate,
  consultarCnpj,
  importarNfeXml,
  NfeDistribuicaoProvider,
  FiscalError,
} from '@adatechnology/fiscal-provider'

@Injectable()
export class FiscalService {
  private providerCache = new Map<string, FiscalProvider>()

  private buildConfig(payload: Record<string, any>): FiscalConfig {
    const model = payload.model || 'nfe'
    const env = payload.environment ?? 'homologacao'

    const baseCommon = {
      model: model,
      environment: env,
      cnpj: payload.cnpj || '',
      inscricaoEstadual: payload.inscricaoEstadual ?? '',
      razaoSocial: payload.razaoSocial ?? 'Empresa Ltda',
      uf: payload.uf || '',
      municipio: payload.municipio ?? '',
      cep: payload.cep ?? '',
      logradouro: payload.logradouro ?? '',
      numero: payload.numero ?? '',
      bairro: payload.bairro ?? '',
    }

    switch (model) {
      case 'nfce':
        return {
          ...baseCommon,
          model: 'nfce' as const,
          certificadoBase64: payload.certificadoBase64 ?? '',
          certificadoSenha: payload.certificadoSenha ?? '',
          serie: payload.serie ?? '1',
          numeroNf: payload.numeroNf ?? 1,
          codigoMunicipio: payload.codigoMunicipio ?? '',
          crt: (payload.crt ?? '1') as '1' | '2' | '3',
          cscId: payload.cscId ?? '',
          cscToken: payload.csc ?? '',
          telefone: payload.telefone,
        }

      case 'nfe':
        return {
          ...baseCommon,
          model: 'nfe' as const,
          certificadoBase64: payload.certificadoBase64 ?? '',
          certificadoSenha: payload.certificadoSenha ?? '',
          serie: payload.serie ?? '1',
          numeroNf: payload.numeroNf ?? 1,
          codigoMunicipio: payload.codigoMunicipio ?? '',
          crt: (payload.crt ?? '1') as '1' | '2' | '3',
          telefone: payload.telefone,
        }

      case 'sat':
        return {
          model: 'sat' as const,
          environment: env,
          cnpj: payload.cnpj || '',
          inscricaoEstadual: payload.inscricaoEstadual ?? '',
          razaoSocial: payload.razaoSocial ?? '',
          uf: payload.uf || '',
          municipio: payload.municipio ?? '',
          cep: payload.cep ?? '',
          logradouro: payload.logradouro ?? '',
          numero: payload.numero ?? '',
          bairro: payload.bairro ?? '',
          crt: (payload.crt ?? '1') as '1' | '2' | '3',
          satUrl: payload.satUrl ?? 'http://localhost:5432',
          activationCode: payload.activationCode ?? '',
          signatureAC: payload.signatureAC ?? '',
        }

      case 'nfse':
        return {
          ...baseCommon,
          model: 'nfse' as const,
          certificadoBase64: payload.certificadoBase64 ?? '',
          certificadoSenha: payload.certificadoSenha ?? '',
          crt: (payload.crt ?? '1') as '1' | '2' | '3',
          webserviceUrl: payload.webserviceUrl ?? '',
          inscricaoMunicipal: payload.inscricaoMunicipal ?? '',
          codigoMunicipio: payload.codigoMunicipio ?? '',
          codigoServico: payload.codigoServico ?? '',
          aliquotaIss: payload.aliquotaIss ?? 5,
          issRetido: payload.issRetido ?? false,
        }

      case 'nfse-notarp':
        return {
          model: 'nfse-notarp' as const,
          environment: env,
          cnpj: payload.cnpj || '',
          razaoSocial: payload.razaoSocial ?? '',
          inscricaoMunicipal: payload.inscricaoMunicipal ?? '',
          apiToken: payload.apiToken ?? '',
          baseUrl: payload.baseUrl,
        }

      case 'cte':
        return {
          ...baseCommon,
          model: 'cte' as const,
          certificadoBase64: payload.certificadoBase64 ?? '',
          certificadoSenha: payload.certificadoSenha ?? '',
          serie: payload.serie ?? '1',
          numeroCte: payload.numeroCte ?? 1,
          codigoMunicipio: payload.codigoMunicipio ?? '',
          crt: (payload.crt ?? '1') as '1' | '2' | '3',
          rntrc: payload.rntrc ?? '',
          telefone: payload.telefone,
        }

      default:
        throw new BadRequestException(`Modelo fiscal não suportado: ${model}`)
    }
  }

  private getProvider(configPayload: Record<string, any>): FiscalProvider {
    const cacheKey = `${configPayload.model}-${configPayload.cnpj}`

    if (!this.providerCache.has(cacheKey)) {
      const config = this.buildConfig(configPayload)
      const provider = createFiscalProvider(config)
      this.providerCache.set(cacheKey, provider)
    }

    return this.providerCache.get(cacheKey)!
  }

  async testConnection(payload: Record<string, any>) {
    const config = this.buildConfig(payload)
    const provider = createFiscalProvider(config)

    try {
      const result = await provider.testConnection({ config })
      return {
        success: result.ok,
        message: result.message,
        model: payload.model,
        environment: payload.environment,
      }
    } catch (error) {
      if (error instanceof FiscalError) {
        return { success: false, message: error.message, code: error.code }
      }
      throw error
    }
  }

  async emit(payload: {
    referenceId: string
    config: Record<string, any>
    totalAmount: number
    discountAmount?: number
    items: {
      codigo: string
      descricao: string
      ncm?: string
      cfop?: string
      cst?: string
      unidade: string
      quantidade: number
      valorUnitario: number
      valorTotal: number
    }[]
    payments: { method: string; amount: number }[]
    nfeData?: {
      destinatario: {
        cnpj?: string
        cpf?: string
        xNome: string
        codigoMunicipio?: string
        cep?: string
        logradouro?: string
        numero?: string
        bairro?: string
        municipio?: string
        uf: string
        indicadorIe?: string
      }
      naturezaOperacao?: string
    }
  }) {
    const config = this.buildConfig(payload.config)
    const provider = this.getProvider(payload.config)

    const emitPayload: Record<string, any> = {
      referenceId: payload.referenceId,
      config,
      totalAmount: payload.totalAmount,
      discountAmount: payload.discountAmount ?? 0,
      items: payload.items.map((item) => ({
        codigo: item.codigo,
        descricao: item.descricao,
        ncm: item.ncm ?? '',
        cfop: item.cfop ?? '',
        cst: item.cst ?? '',
        unidade: item.unidade,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
      })),
      payments: payload.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
    }

    if (payload.nfeData && config.model === 'nfe') {
      emitPayload.nfeData = {
        destinatario: {
          ...payload.nfeData.destinatario,
          indicadorIe: (payload.nfeData.destinatario.indicadorIe ?? '9') as '1' | '2' | '9',
        },
        naturezaOperacao: payload.nfeData.naturezaOperacao,
      }
    }

    try {
      const result = await provider.emit(emitPayload as EmitFiscalParams)

      if (result.success) {
        return {
          success: true,
          chaveAcesso: result.chaveAcesso,
          protocolo: result.protocolo,
          numeroDocumento: result.numeroDocumento,
          serie: result.serie,
          xmlAutorizado: result.xmlAutorizado,
          qrCodeUrl: result.qrCodeUrl,
          danfce: result.danfce,
        }
      }

      return {
        success: false,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      }
    } catch (error) {
      if (error instanceof FiscalError) {
        return { success: false, errorMessage: error.message, errorCode: error.code }
      }
      throw error
    }
  }

  async cancel(payload: {
    chaveAcesso: string
    protocolo: string
    justificativa: string
    config: Record<string, any>
  }) {
    const config = this.buildConfig(payload.config)
    const provider = this.getProvider(payload.config)

    try {
      const result = await provider.cancel({
        chaveAcesso: payload.chaveAcesso,
        protocolo: payload.protocolo,
        justificativa: payload.justificativa,
        config,
      } as CancelFiscalParams)

      return {
        success: result.success,
        protocoloCancelamento: result.protocolo,
        xmlEvento: result.xmlAutorizado,
      }
    } catch (error) {
      if (error instanceof FiscalError) {
        return { success: false, errorMessage: error.message, errorCode: error.code }
      }
      throw error
    }
  }

  async uploadCertificate(file: Express.Multer.File, senha: string) {
    const certificadoBase64 = file.buffer.toString('base64')

    try {
      const info = validateCertificate(certificadoBase64, senha)
      return {
        certificadoBase64,
        fileName: file.originalname,
        size: file.size,
        valid: info.valid,
        subject: info.subject,
        issuer: info.issuer,
        validFrom: info.validFrom,
        expiresAt: info.expiresAt,
        cnpj: info.cnpj,
        cpf: info.cpf,
        hasPrivateKey: info.hasPrivateKey,
        isExpired: info.isExpired,
        isIcpBrasil: info.isIcpBrasil,
        canSign: info.canSign,
        errors: info.errors,
        warnings: info.warnings,
      }
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Falha ao processar certificado')
    }
  }

  async consultaCnpj(cnpj: string) {
    return consultarCnpj(cnpj)
  }

  async validateXml(xml: string) {
    if (!xml || xml.trim().length === 0) {
      throw new BadRequestException('XML é obrigatório')
    }

    const errors: string[] = []
    const warnings: string[] = []
    const result: Record<string, unknown> = {
      wellFormed: false,
      documentType: 'desconhecido',
      errors,
      warnings,
    }

    const trimmed = xml.trim()

    if (!trimmed.startsWith('<')) {
      errors.push('XML não começa com "<" — verifique se é um XML válido')
      return result
    }

    try {
      const dfeItem = importarNfeXml(trimmed)
      result.wellFormed = true
      result.documentType = dfeItem.mod === '65' ? 'NFC-e (65)' : `NF-e (${dfeItem.mod})`
      result.chaveAcesso = dfeItem.chaveNfe
      result.cnpjEmitente = dfeItem.emitenteCnpj
      result.nomeEmitente = dfeItem.emitenteNome
      result.valorTotal = dfeItem.valorTotal
      result.dataEmissao = dfeItem.dataEmissao
      result.schema = dfeItem.schema
      if (dfeItem.tipoEvento) {
        result.tipoEvento = dfeItem.tipoEvento
        result.descricaoEvento = dfeItem.descricaoEvento
      }
      return result
    } catch {
      // NF-e/NFC-e not recognized, try CT-e and other formats
    }

    try {
      const tag = trimmed.match(/<(\w+)[\s>]/)?.[1] || ''
      const cteMatch = trimmed.match(/<CTe|<cteProc|<CFe|<infCFe|<nfse|<Nfse|<Rps/i)

      if (cteMatch) {
        const type = cteMatch[0].replace(/</g, '')
        result.wellFormed = true
        result.documentType = type.startsWith('C') ? 'CT-e' : type.startsWith('cf') ? 'CF-e (SAT)' : 'NFS-e'

        const cnpjMatch = trimmed.match(/<CNPJ[^>]*>(\d{14})<\/CNPJ>/)
        if (cnpjMatch) result.cnpjEmitente = cnpjMatch[1]

        const chaveMatch = trimmed.match(
          /<chave[^>]*>(\d{44})<\/chave|<chCTe[^>]*>(\d{44})<\/chCTe|<Id[^>]*>[^"]*(\d{44})/,
        )
        if (chaveMatch) result.chaveAcesso = chaveMatch[1] || chaveMatch[2] || chaveMatch[3]

        const valorMatch = trimmed.match(
          /<vNF[^>]*>([\d.]+)<\/vNF|<vCFe[^>]*>([\d.]+)<\/vCFe|<vServ[^>]*>([\d.]+)<\/vServ/,
        )
        if (valorMatch) result.valorTotal = parseFloat(valorMatch[1] || valorMatch[2] || valorMatch[3])

        const razaoMatch = trimmed.match(/<xNome[^>]*>([^<]+)<\/xNome/)
        if (razaoMatch) result.nomeEmitente = razaoMatch[1]

        const dhEmiMatch = trimmed.match(/<dhEmi[^>]*>([^<]+)<\/dhEmi|<dEmi[^>]*>([^<]+)<\/dEmi/)
        if (dhEmiMatch) result.dataEmissao = dhEmiMatch[1] || dhEmiMatch[2]

        warnings.push('Documento validado por heurística (não usando parser oficial de NF-e)')
        return result
      }

      result.wellFormed = true
      result.documentType = tag || 'xml-genérico'
      warnings.push(
        'Estrutura XML reconhecida, mas não é um documento fiscal conhecido (NF-e, NFC-e, CT-e, CF-e ou NFS-e)',
      )
      return result
    } catch {
      errors.push('Falha ao analisar estrutura do XML')
      return result
    }
  }

  async importXmlBatch(files: Express.Multer.File[]) {
    const results = files.map((file) => {
      try {
        const xml = file.buffer.toString('utf-8')
        const parsed = importarNfeXml(xml)
        return {
          fileName: file.originalname,
          success: true,
          chaveNfe: parsed.chaveNfe,
          cnpjEmitente: parsed.emitenteCnpj,
          nomeEmitente: parsed.emitenteNome,
          valorTotal: parsed.valorTotal,
          dataEmissao: parsed.dataEmissao,
          modelo: parsed.mod,
          schema: parsed.schema,
        }
      } catch (error) {
        return {
          fileName: file.originalname,
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao importar XML',
        }
      }
    })

    const sucesso = results.filter((r) => r.success).length
    const falha = results.length - sucesso

    return {
      total: results.length,
      sucesso,
      falha,
      resultados: results,
    }
  }

  async importXmlText(xmls: string[]) {
    const results = xmls.map((xml, index) => {
      try {
        const parsed = importarNfeXml(xml)
        return {
          index,
          success: true,
          chaveNfe: parsed.chaveNfe,
          cnpjEmitente: parsed.emitenteCnpj,
          nomeEmitente: parsed.emitenteNome,
          valorTotal: parsed.valorTotal,
          dataEmissao: parsed.dataEmissao,
          modelo: parsed.mod,
        }
      } catch (error) {
        return {
          index,
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao importar XML',
        }
      }
    })

    const sucesso = results.filter((r) => r.success).length
    const falha = results.length - sucesso

    return {
      total: results.length,
      sucesso,
      falha,
      resultados: results,
    }
  }

  async getCertificateInfo(certificadoBase64: string, certificadoSenha: string) {
    const info = validateCertificate(certificadoBase64, certificadoSenha)

    return {
      valid: info.valid,
      subject: info.subject,
      issuer: info.issuer,
      validFrom: info.validFrom,
      expiresAt: info.expiresAt,
      cnpj: info.cnpj,
      cpf: info.cpf,
      hasPrivateKey: info.hasPrivateKey,
      isExpired: info.isExpired,
      isIcpBrasil: info.isIcpBrasil,
      canSign: info.canSign,
      errors: info.errors,
      warnings: info.warnings,
    }
  }

  async consultarDistribuicao(payload: {
    cnpj: string
    uf: string
    environment: string
    certificadoBase64: string
    certificadoSenha: string
    ultNsu?: string
  }) {
    const config = {
      model: 'nfe-distribuicao' as const,
      cnpj: payload.cnpj,
      uf: payload.uf,
      environment: (payload.environment === 'producao' ? 'producao' : 'homologacao') as 'producao' | 'homologacao',
      certificadoBase64: payload.certificadoBase64,
      certificadoSenha: payload.certificadoSenha,
    }

    const provider = new NfeDistribuicaoProvider()
    const result = await provider.consultarDFe({
      config,
      ultNSU: payload.ultNsu || '000000000000000',
    })

    return {
      ultNSU: result.ultNSU,
      maxNSU: result.maxNSU,
      total: result.itens.length,
      items: result.itens.map((item) => ({
        nsu: item.nsu,
        schema: item.schema,
        chaveNfe: item.chaveNfe,
        mod: item.mod,
        emitenteCnpj: item.emitenteCnpj,
        emitenteNome: item.emitenteNome,
        valorTotal: item.valorTotal,
        dataEmissao: item.dataEmissao,
        situacao: item.situacao,
        tipoEvento: item.tipoEvento,
        descricaoEvento: item.descricaoEvento,
        dataEvento: item.dataEvento,
      })),
    }
  }
}
