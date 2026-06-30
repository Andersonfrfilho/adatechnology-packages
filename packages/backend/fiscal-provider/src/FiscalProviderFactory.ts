import type { FiscalProvider } from './FiscalProvider.interface'
import type { FiscalConfig } from './types'
import { SefazNfceProvider } from './providers/SefazNfceProvider'
import { SefazNfeProvider } from './providers/SefazNfeProvider'
import { SatProvider } from './providers/SatProvider'
import { NfseProvider } from './providers/NfseProvider'
import { NotaRpNfseProvider } from './providers/NotaRpNfseProvider'

export function createFiscalProvider(config: FiscalConfig): FiscalProvider {
  if (config.model === 'nfce')        return new SefazNfceProvider()
  if (config.model === 'nfe')         return new SefazNfeProvider()
  if (config.model === 'sat')         return new SatProvider()
  if (config.model === 'nfse')        return new NfseProvider()
  if (config.model === 'nfse-notarp') return new NotaRpNfseProvider()

  const _exhaustive: never = config
  throw new Error(`Modelo fiscal desconhecido: ${JSON.stringify(_exhaustive)}`)
}
