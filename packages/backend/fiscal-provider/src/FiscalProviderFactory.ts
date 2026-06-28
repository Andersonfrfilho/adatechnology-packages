import type { FiscalProvider } from './FiscalProvider.interface'
import type { FiscalConfig } from './types'
import { SefazNfceProvider } from './providers/SefazNfceProvider'
import { SatProvider } from './providers/SatProvider'

export function createFiscalProvider(config: FiscalConfig): FiscalProvider {
  if (config.model === 'nfce') return new SefazNfceProvider()
  if (config.model === 'sat') return new SatProvider()

  const _exhaustive: never = config
  throw new Error(`Modelo fiscal desconhecido: ${JSON.stringify(_exhaustive)}`)
}
