import type { EmitFiscalParams, NfceConfig, FiscalResult, DanfceData } from '../types'

type BuildDanfceParams = {
  readonly emitParams: EmitFiscalParams
  readonly config: NfceConfig
  readonly result: FiscalResult
  readonly qrCodeUrl: string
  readonly urlConsulta: string
  readonly dataEmissao: Date
}

export function buildDanfce(params: BuildDanfceParams): DanfceData {
  const text = buildDanfceText(params)
  return {
    text,
    qrCodeUrl: params.qrCodeUrl,
    urlConsulta: params.urlConsulta,
  }
}

function buildDanfceText({
  emitParams, config, result, qrCodeUrl, urlConsulta, dataEmissao,
}: BuildDanfceParams): string {
  const SEP = '━'.repeat(32)
  const lines: string[] = []

  const center = (text: string) => text.padStart(Math.floor((32 + text.length) / 2)).padEnd(32)
  const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`
  const formatCnpj = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, '')
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }
  const formatDate = (d: Date) => {
    const p = (n: number) => n.toString().padStart(2, '0')
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  // Cabeçalho
  lines.push(SEP)
  lines.push(center(config.razaoSocial))
  lines.push(center(`CNPJ: ${formatCnpj(config.cnpj)}`))
  lines.push(center(`${config.logradouro}, ${config.numero}`))
  lines.push(center(`${config.municipio} - ${config.uf}`))
  if (config.telefone) lines.push(center(`Tel: ${config.telefone}`))
  lines.push(SEP)
  lines.push(center('NOTA FISCAL NFC-e (DANFE)'))
  lines.push(`Nº ${String(config.numeroNf).padStart(9, '0')}   Série: ${config.serie.padStart(3, '0')}`)
  lines.push(formatDate(dataEmissao))
  lines.push(SEP)

  // Itens
  lines.push('DESCRIÇÃO           QTD × PREÇO    TOTAL')
  for (const item of emitParams.items) {
    lines.push(item.descricao.slice(0, 32))
    const detail = `${item.quantidade}x ${money(item.valorUnitario)}`
    lines.push(`${detail.padEnd(20)}${money(item.valorTotal).padStart(12)}`)
  }
  lines.push(SEP)

  // Totais
  if (emitParams.discountAmount > 0) {
    lines.push(`${'Desconto'.padEnd(20)}${money(-emitParams.discountAmount).padStart(12)}`)
  }
  lines.push(`${'TOTAL'.padEnd(20)}${money(emitParams.totalAmount).padStart(12)}`)
  lines.push('')

  // Pagamentos
  for (const payment of emitParams.payments) {
    const label = PAYMENT_LABELS[payment.method] ?? payment.method
    lines.push(`${label.padEnd(20)}${money(payment.amount).padStart(12)}`)
  }
  lines.push(SEP)

  // Status da nota
  if (result.success) {
    lines.push('✅ NFC-e AUTORIZADA')
    if (result.protocolo) lines.push(`Protocolo: ${result.protocolo}`)
  } else {
    lines.push('❌ NFC-e REJEITADA')
    if (result.errorCode) lines.push(`Código: ${result.errorCode}`)
    if (result.errorMessage) lines.push(`Motivo: ${result.errorMessage}`)
  }
  lines.push(SEP)

  // Chave de acesso
  lines.push('CHAVE DE ACESSO:')
  const chave = result.chaveAcesso ?? ''
  // Grupos de 4 dígitos para facilitar leitura
  for (let i = 0; i < chave.length; i += 16) {
    lines.push(chave.slice(i, i + 16).match(/.{1,4}/g)?.join(' ') ?? '')
  }
  lines.push('')

  // QR Code e consulta
  lines.push(`Consulte em: ${urlConsulta}`)
  lines.push(`QR: ${qrCodeUrl}`)
  lines.push(SEP)

  return lines.join('\n')
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  card_credit: 'Cartão Crédito',
  card_debit: 'Cartão Débito',
  cash: 'Dinheiro',
  voucher: 'Vale/Voucher',
}
