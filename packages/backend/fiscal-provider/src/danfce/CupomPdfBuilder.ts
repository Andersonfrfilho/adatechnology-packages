import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import type { EmitFiscalParams, FiscalConfig, FiscalResult } from '../types'

const PAGE_WIDTH_PT = 226.77 // ~80mm térmica
const MARGIN = 12
const CONTENT_WIDTH = PAGE_WIDTH_PT - MARGIN * 2

export type BuildCupomPdfParams = {
  readonly emitParams: EmitFiscalParams
  readonly config: FiscalConfig
  readonly result: FiscalResult
  readonly qrCodePayload: string
  readonly urlConsulta?: string
  readonly dataEmissao?: Date
  readonly documentLabel?: string
}

export type CupomPdfResult = {
  readonly base64: string
  readonly mimeType: 'application/pdf'
  readonly fileName: string
}

function money(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatDate(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatChave(chave: string): string {
  const digits = chave.replace(/\D/g, '')
  return digits.match(/.{1,4}/g)?.join(' ') ?? chave
}

function getConfigAddress(config: FiscalConfig): {
  razaoSocial: string
  cnpj: string
  logradouro?: string
  numero?: string
  municipio?: string
  uf?: string
  serie?: string
  numeroNf?: number
} {
  const c = config as FiscalConfig & {
    logradouro?: string
    numero?: string
    municipio?: string
    uf?: string
    serie?: string
    numeroNf?: number
    numeroCte?: number
  }

  return {
    razaoSocial: 'razaoSocial' in c ? String(c.razaoSocial ?? '') : '',
    cnpj: String(c.cnpj ?? ''),
    logradouro: c.logradouro,
    numero: c.numero,
    municipio: c.municipio,
    uf: c.uf,
    serie: c.serie,
    numeroNf: c.numeroNf ?? c.numeroCte,
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  PIX: 'Pix',
  card_credit: 'Cartão Crédito',
  credit: 'Cartão Crédito',
  card_debit: 'Cartão Débito',
  debit: 'Cartão Débito',
  cash: 'Dinheiro',
  money: 'Dinheiro',
  voucher: 'Vale/Voucher',
}

/**
 * Gera PDF do cupom fiscal (DANFCE / CF-e) em formato 80mm com QR Code.
 * Uso típico: após `emit()` com sucesso — imprimir ou baixar o PDF.
 */
export async function buildCupomPdf(params: BuildCupomPdfParams): Promise<CupomPdfResult> {
  const { emitParams, config, result, qrCodePayload, urlConsulta, dataEmissao = new Date(), documentLabel } = params

  const meta = getConfigAddress(config)
  const model = config.model
  const label =
    documentLabel ??
    (model === 'sat'
      ? 'CUPOM FISCAL ELETRÔNICO — SAT (CF-e)'
      : model === 'nfce'
        ? 'NOTA FISCAL DE CONSUMIDOR ELETRÔNICA — NFC-e'
        : `DOCUMENTO FISCAL — ${String(model).toUpperCase()}`)

  const qrPng = await QRCode.toBuffer(qrCodePayload, {
    type: 'png',
    width: 160,
    margin: 1,
    errorCorrectionLevel: 'M',
  })

  const doc = new PDFDocument({
    size: [PAGE_WIDTH_PT, 900],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfDone = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  doc.font('Courier').fontSize(8)

  const center = (text: string, size = 8, bold = false) => {
    doc.font(bold ? 'Courier-Bold' : 'Courier').fontSize(size)
    doc.text(text, { align: 'center', width: CONTENT_WIDTH })
  }

  const line = (text: string, opts?: { bold?: boolean; size?: number }) => {
    doc.font(opts?.bold ? 'Courier-Bold' : 'Courier').fontSize(opts?.size ?? 8)
    doc.text(text, { width: CONTENT_WIDTH, align: 'left' })
  }

  const sep = () => line('--------------------------------')

  center(meta.razaoSocial || 'EMITENTE', 9, true)
  center(`CNPJ: ${formatCnpj(meta.cnpj)}`)
  if (meta.logradouro) {
    center(`${meta.logradouro}${meta.numero ? `, ${meta.numero}` : ''}`)
  }
  if (meta.municipio && meta.uf) {
    center(`${meta.municipio} - ${meta.uf}`)
  }
  sep()
  center(label, 7, true)
  const numero = result.numeroDocumento ?? meta.numeroNf
  const serie = result.serie ?? meta.serie ?? '1'
  if (numero != null) {
    center(`Nº ${String(numero).padStart(9, '0')}  Série: ${serie}`)
  }
  center(formatDate(dataEmissao))
  sep()

  line('DESCRIÇÃO', { bold: true })
  for (const item of emitParams.items) {
    line(item.descricao.slice(0, 36))
    line(`${item.quantidade} ${item.unidade} x ${money(item.valorUnitario)} = ${money(item.valorTotal)}`)
  }
  sep()

  if ((emitParams.discountAmount ?? 0) > 0) {
    line(`Desconto: ${money(-(emitParams.discountAmount ?? 0))}`)
  }
  line(`TOTAL: ${money(emitParams.totalAmount)}`, { bold: true, size: 10 })
  doc.moveDown(0.3)

  for (const payment of emitParams.payments) {
    const payLabel = PAYMENT_LABELS[payment.method] ?? payment.method
    line(`${payLabel}: ${money(payment.amount)}`)
  }
  sep()

  if (result.success) {
    center('AUTORIZADO', 10, true)
    if (result.protocolo) center(`Protocolo: ${result.protocolo}`)
  } else {
    center('NÃO AUTORIZADO', 10, true)
    if (result.errorMessage) center(result.errorMessage.slice(0, 80))
  }
  sep()

  if (result.chaveAcesso) {
    line('CHAVE DE ACESSO:', { bold: true })
    const chaveFmt = formatChave(result.chaveAcesso)
    for (let i = 0; i < chaveFmt.length; i += 44) {
      line(chaveFmt.slice(i, i + 44), { size: 7 })
    }
  }

  if (urlConsulta) {
    doc.moveDown(0.3)
    line('Consulte em:', { bold: true })
    line(urlConsulta, { size: 6 })
  }

  doc.moveDown(0.5)
  const qrSize = 110
  const qrX = MARGIN + (CONTENT_WIDTH - qrSize) / 2
  doc.image(qrPng, qrX, doc.y, { width: qrSize, height: qrSize })
  doc.y += qrSize + 6
  center('Consulte pelo QR Code', 7)

  sep()
  center('Documento gerado por @adatechnology/fiscal-provider', 6)

  doc.end()
  const buffer = await pdfDone
  const chaveSuffix = (result.chaveAcesso ?? 'cupom').replace(/\D/g, '').slice(-8) || 'cupom'
  const fileName = `cupom-${model}-${chaveSuffix}.pdf`

  return {
    base64: buffer.toString('base64'),
    mimeType: 'application/pdf',
    fileName,
  }
}
