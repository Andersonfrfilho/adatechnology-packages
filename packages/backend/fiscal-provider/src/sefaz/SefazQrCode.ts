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

// NT 2016.002 QRCODE V2 ONLINE: p=chave|2|tpAmb|cIdToken|hash
// hash = SHA1(dadosBase + CSC), onde dadosBase = "chave|2|tpAmb|cIdToken" (os 4 campos com pipe,
// exatamente o prefixo do parâmetro p) e o CSC é concatenado ao final sem separador.
// cIdToken vai sem zero à esquerda na URL/hash (XSD: (0|[1-9]{1}([0-9]{1,5})?) — rejeita "000002")
export function buildQrCodeUrl(params: BuildQrCodeParams): string {
  const { chave, cscId, cscToken, uf, environment, tpAmb } = params
  const cIdToken = String(Number.parseInt(cscId, 10))
  const dadosBase = `${chave.chave}|2|${tpAmb}|${cIdToken}`
  const hash = createHash('sha1')
    .update(dadosBase + cscToken)
    .digest('hex')
    .toUpperCase()
  const { qrCode } = getSefazQrCodeInfo(uf, environment)
  return `${qrCode}?p=${dadosBase}|${hash}`
}

export function buildInfNFeSupl(qrCodeUrl: string, urlChave: string): string {
  const escUrl = (s: string) => s.replace(/&/g, '&amp;')
  return `<infNFeSupl><qrCode>${escUrl(qrCodeUrl)}</qrCode><urlChave>${urlChave}</urlChave></infNFeSupl>`
}
