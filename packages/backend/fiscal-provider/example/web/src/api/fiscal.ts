import type { ConnectionResult, EmitItem, EmitPayment, EmitResult, CancelResult, CertificateInfo } from '../types'

const BASE_URL = '/api'

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function testConnection(config: Record<string, unknown>): Promise<ConnectionResult> {
  return request<ConnectionResult>('/fiscal/test-connection', config)
}

export async function emitDocument(data: {
  referenceId: string
  config: Record<string, unknown>
  totalAmount: number
  discountAmount?: number
  items: EmitItem[]
  payments: EmitPayment[]
  nfeData?: Record<string, unknown>
}): Promise<EmitResult> {
  return request<EmitResult>('/fiscal/emit', data)
}

/** Gera PDF do cupom sem emitir (para testar layout / impressão Elgin i8) */
export async function previewCupom(data: {
  referenceId: string
  config: Record<string, unknown>
  totalAmount: number
  discountAmount?: number
  items: EmitItem[]
  payments: EmitPayment[]
}): Promise<EmitResult> {
  return request<EmitResult>('/fiscal/preview-cupom', data)
}

export function downloadCupomPdf(cupomPdf: { base64: string; mimeType: string; fileName: string }): void {
  const binary = atob(cupomPdf.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: cupomPdf.mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = cupomPdf.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function openCupomPdf(cupomPdf: { base64: string; mimeType: string }): void {
  const binary = atob(cupomPdf.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: cupomPdf.mimeType })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

/** Abre o cupom (DANFCE com QR) e dispara a impressão — versão de impressão do documento. */
export function printCupomPdf(cupomPdf: { base64: string; mimeType: string }): void {
  const binary = atob(cupomPdf.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: cupomPdf.mimeType })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.addEventListener('load', () => {
      win.focus()
      win.print()
    })
  }
}

export interface QrCodeCheck {
  name: string
  passed: boolean
  detail?: string
}

export interface VerifyQrCodeResult {
  valid: boolean
  expectedHash?: string
  parts?: {
    baseUrl: string
    chave: string
    versao: string
    tpAmb: string
    cIdToken: string
    hash: string
  }
  checks: QrCodeCheck[]
}

export async function verifyQrCode(qrCodeUrl: string, cscToken: string): Promise<VerifyQrCodeResult> {
  return request<VerifyQrCodeResult>('/fiscal/verify-qrcode', { qrCodeUrl, cscToken })
}

/** Baixa o XML autorizado como arquivo .xml */
export function downloadXml(xml: string, fileName: string): void {
  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export async function cancelDocument(data: {
  chaveAcesso: string
  protocolo: string
  justificativa: string
  model: string
  environment: string
  uf: string
  cnpj: string
  certificadoBase64?: string
  certificadoSenha?: string
  csc?: string
  cscId?: string
  serie?: string
}): Promise<CancelResult> {
  return request<CancelResult>('/fiscal/cancel', data)
}

export async function certificateInfo(certificadoBase64: string, certificadoSenha: string): Promise<CertificateInfo> {
  return request<CertificateInfo>('/fiscal/certificate-info', { certificadoBase64, certificadoSenha })
}

export interface CnpjData {
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string
  situacao: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  codigoMunicipio?: string
  uf?: string
  cep?: string
  telefone?: string
  email?: string
  optanteSimplesNacional?: boolean
  inscricaoEstadual?: string
}

export async function consultaCnpj(cnpj: string): Promise<CnpjData> {
  const res = await fetch(`/api/fiscal/consulta-cnpj/${cnpj.replace(/\D/g, '')}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface XmlValidationResult {
  wellFormed: boolean
  documentType: string
  chaveAcesso?: string
  cnpjEmitente?: string
  nomeEmitente?: string
  valorTotal?: number
  dataEmissao?: string
  schema?: string
  tipoEvento?: string
  descricaoEvento?: string
  errors: string[]
  warnings: string[]
}

export async function validateXml(xml: string): Promise<XmlValidationResult> {
  return request<XmlValidationResult>('/fiscal/validate-xml', { xml })
}

export interface BatchImportItem {
  fileName: string
  success: boolean
  chaveNfe?: string
  cnpjEmitente?: string
  nomeEmitente?: string
  valorTotal?: number
  dataEmissao?: string
  modelo?: string
  error?: string
}

export interface BatchImportResult {
  total: number
  sucesso: number
  falha: number
  resultados: BatchImportItem[]
}

export async function importXmlBatch(files: File[]): Promise<BatchImportResult> {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  const res = await fetch('/api/fiscal/import-xml-batch', { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface DfeItemResult {
  nsu: string
  schema: string
  chaveNfe?: string
  mod?: string
  emitenteCnpj?: string
  emitenteNome?: string
  valorTotal?: number
  dataEmissao?: string
  situacao?: string
  tipoEvento?: string
  descricaoEvento?: string
  dataEvento?: string
}

export interface ConsultarDistribuicaoResult {
  ultNSU: string
  maxNSU: string
  total: number
  items: DfeItemResult[]
}

export async function consultarDistribuicao(payload: {
  cnpj: string
  uf: string
  environment: string
  certificadoBase64: string
  certificadoSenha: string
  ultNsu?: string
}): Promise<ConsultarDistribuicaoResult> {
  return request<ConsultarDistribuicaoResult>('/fiscal/consultar-distribuicao', payload)
}
