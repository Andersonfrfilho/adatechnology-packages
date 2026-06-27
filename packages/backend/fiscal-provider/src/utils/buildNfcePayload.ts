import type { EmitFiscalParams, NfceConfig } from '../types'
import { toNfcePaymentCode } from './mapPaymentMethod'

type NfceItem = {
  numero_item: number
  codigo_produto: string
  descricao: string
  codigo_ncm: string
  cfop: string
  unidade_comercial: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  valor_bruto: number
  icms_situacao_tributaria: string
  pis_situacao_tributaria: string
  cofins_situacao_tributaria: string
}

type NfcePayment = {
  forma_pagamento: string
  valor_pagamento: string
}

type NfcePayload = {
  natureza_operacao: string
  forma_pagamento: number
  serie: string
  tipo_documento: number
  local_destino: number
  consumidor_final: number
  presenca_comprador: number
  emitente: {
    cnpj: string
    nome_razao_social: string
    inscricao_estadual: string
    regime_tributario: number
    endereco: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      codigo_municipio_ibge?: string
      uf: string
      cep: string
    }
  }
  itens: NfceItem[]
  formas_pagamento: NfcePayment[]
  informacoes_adicionais_contribuinte?: string
  cpf_destinatario?: string
}

export function buildNfcePayload(params: EmitFiscalParams, config: NfceConfig): NfcePayload {
  const crtCode = parseInt(config.crt, 10)

  const itens: NfceItem[] = params.items.map((item, index) => ({
    numero_item: index + 1,
    codigo_produto: item.codigo,
    descricao: item.descricao,
    codigo_ncm: item.ncm,
    cfop: item.cfop,
    unidade_comercial: item.unidade,
    quantidade_comercial: item.quantidade,
    valor_unitario_comercial: item.valorUnitario,
    valor_bruto: item.valorTotal,
    icms_situacao_tributaria: item.cst,
    pis_situacao_tributaria: '07',
    cofins_situacao_tributaria: '07',
  }))

  const formas_pagamento: NfcePayment[] = params.payments.map((payment) => ({
    forma_pagamento: toNfcePaymentCode(payment.method),
    valor_pagamento: payment.amount.toFixed(2),
  }))

  const payload: NfcePayload = {
    natureza_operacao: 'Venda ao consumidor',
    forma_pagamento: 0,
    serie: config.serie,
    tipo_documento: 1,
    local_destino: 1,
    consumidor_final: 1,
    presenca_comprador: 2,
    emitente: {
      cnpj: config.cnpj.replace(/\D/g, ''),
      nome_razao_social: config.razaoSocial,
      inscricao_estadual: config.inscricaoEstadual,
      regime_tributario: crtCode,
      endereco: {
        logradouro: config.logradouro,
        numero: config.numero,
        bairro: config.bairro,
        uf: config.uf,
        cep: config.cep.replace(/\D/g, ''),
        ...(config.complemento ? { complemento: config.complemento } : {}),
      },
    },
    itens,
    formas_pagamento,
  }

  if (params.customerCpf) {
    payload.cpf_destinatario = params.customerCpf.replace(/\D/g, '')
  }

  return payload
}
