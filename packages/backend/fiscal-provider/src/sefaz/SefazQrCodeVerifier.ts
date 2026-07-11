import { createHash } from 'crypto'
import { isChaveDvValid } from './SefazChave'

/**
 * Verificação do QR Code da NFC-e (NT 2016.002 — QRCODE V2 online).
 *
 * Formato: {urlConsulta}?p=chave|2|tpAmb|cIdToken|hash
 * onde hash = SHA1(chave + tpAmb + cIdToken + cscToken), em HEX maiúsculo.
 *
 * A verificação é determinística e offline: recalcula o hash com o CSC informado e
 * compara com o hash presente na URL. É a forma de confirmar que o QR Code foi gerado
 * com o CSC correto (o mesmo credenciado na SEFAZ) — se o hash não bate, o leitor do
 * consumidor acusaria QR inválido mesmo com a nota autorizada.
 */

const QR_CODE_VERSION = '2'

export type QrCodeParts = {
  readonly baseUrl: string
  readonly chave: string
  readonly versao: string
  readonly tpAmb: string
  readonly cIdToken: string
  readonly hash: string
}

export type QrCodeCheck = {
  readonly name: string
  readonly passed: boolean
  readonly detail?: string
}

export type VerifyQrCodeParams = {
  readonly qrCodeUrl: string
  readonly cscToken: string
}

export type VerifyQrCodeResult = {
  readonly valid: boolean
  readonly parts?: QrCodeParts
  readonly expectedHash?: string
  readonly checks: readonly QrCodeCheck[]
}

export type ComputeQrCodeHashParams = {
  readonly chave: string
  readonly tpAmb: string
  readonly cIdToken: string
  readonly cscToken: string
}

export function computeQrCodeHash(params: ComputeQrCodeHashParams): string {
  // Igual ao builder: SHA1("chave|2|tpAmb|cIdToken" + CSC)
  const dadosBase = `${params.chave}|${QR_CODE_VERSION}|${params.tpAmb}|${params.cIdToken}`
  return createHash('sha1')
    .update(dadosBase + params.cscToken)
    .digest('hex')
    .toUpperCase()
}

export function parseQrCodeUrl(qrCodeUrl: string): QrCodeParts | undefined {
  const queryIndex = qrCodeUrl.indexOf('?p=')
  if (queryIndex === -1) return undefined

  const baseUrl = qrCodeUrl.slice(0, queryIndex)
  const fields = qrCodeUrl.slice(queryIndex + 3).split('|')
  if (fields.length !== 5) return undefined

  const [chave, versao, tpAmb, cIdToken, hash] = fields
  return {
    baseUrl,
    chave: chave!,
    versao: versao!,
    tpAmb: tpAmb!,
    cIdToken: cIdToken!,
    hash: hash!.toUpperCase(),
  }
}

/** Verifica estrutura + dígito verificador + hash do QR Code contra o CSC informado. */
export function verifyQrCode({ qrCodeUrl, cscToken }: VerifyQrCodeParams): VerifyQrCodeResult {
  const parts = parseQrCodeUrl(qrCodeUrl)
  if (!parts) {
    return {
      valid: false,
      checks: [{ name: 'formato', passed: false, detail: 'URL sem "?p=" ou sem os 5 campos separados por "|"' }],
    }
  }

  const chaveFormatoOk = /^\d{44}$/.test(parts.chave)
  const cIdTokenOk = /^[1-9]\d{0,5}$/.test(parts.cIdToken)
  const expectedHash = computeQrCodeHash({
    chave: parts.chave,
    tpAmb: parts.tpAmb,
    cIdToken: parts.cIdToken,
    cscToken,
  })

  const checks: QrCodeCheck[] = [
    { name: 'formato', passed: true },
    {
      name: 'chave-44-digitos',
      passed: chaveFormatoOk,
      detail: chaveFormatoOk ? undefined : `chave tem ${parts.chave.length} caracteres`,
    },
    { name: 'digito-verificador', passed: chaveFormatoOk && isChaveDvValid(parts.chave) },
    {
      name: 'versao-qrcode',
      passed: parts.versao === QR_CODE_VERSION,
      detail: parts.versao === QR_CODE_VERSION ? undefined : `versão ${parts.versao}, esperado ${QR_CODE_VERSION}`,
    },
    {
      name: 'tpAmb',
      passed: parts.tpAmb === '1' || parts.tpAmb === '2',
      detail: parts.tpAmb === '1' || parts.tpAmb === '2' ? undefined : `tpAmb inválido: ${parts.tpAmb}`,
    },
    {
      name: 'cIdToken',
      passed: cIdTokenOk,
      detail: cIdTokenOk ? undefined : 'cIdToken deve ser numérico sem zero à esquerda',
    },
    {
      name: 'hash-csc',
      passed: expectedHash === parts.hash,
      detail:
        expectedHash === parts.hash
          ? undefined
          : `hash não confere com o CSC informado (esperado ${expectedHash}, veio ${parts.hash})`,
    },
  ]

  return { valid: checks.every((check) => check.passed), parts, expectedHash, checks }
}
