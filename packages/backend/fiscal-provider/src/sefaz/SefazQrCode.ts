import { createHash } from 'crypto'
import type { ChaveAcesso } from './SefazChave'
import { getSefazQrCodeInfo } from './SefazConstants'

type BuildQrCodeParams = {
  readonly chave: ChaveAcesso
  readonly cscId: string
  readonly cscToken: string
  readonly uf: string
  readonly environment: 'homologacao' | 'producao'
  readonly tpAmb: string
}

// NT 2016.002: hash = SHA1(chNFe + tpAmb + cIdToken + csc)
export function buildQrCodeUrl(params: BuildQrCodeParams): string {
  const { chave, cscId, cscToken, uf, environment, tpAmb } = params
  const cIdToken = cscId.padStart(6, '0')
  const hash = createHash('sha1')
    .update(chave.chave + tpAmb + cIdToken + cscToken)
    .digest('hex')
    .toUpperCase()
  const { qrCode } = getSefazQrCodeInfo(uf, environment)
  return `${qrCode}?p=${chave.chave}|${tpAmb}|${cIdToken}|${hash}`
}

export function buildInfNFeSupl(qrCodeUrl: string, urlFe: string): string {
  const escUrl = (s: string) => s.replace(/&/g, '&amp;')
  return `<infNFeSupl><qrCode>${escUrl(qrCodeUrl)}</qrCode><urlFe>${urlFe}</urlFe></infNFeSupl>`
}
