/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import nativeStonePos from './NativeStonePos'
import type { StonePos } from './StonePos'
import { createStonePosDeeplink } from './StonePosDeeplink'

export type { StonePos } from './StonePos'
export type * from './types'
export { StonePosError } from './StonePosError'
export { createStonePosMock } from './StonePosMock'
export type { PrintedCopy, StonePosMock } from './StonePosMock'

const UNAVAILABLE_MESSAGE =
  'Maquininha Stone indisponivel: os apps de pagamento da Stone nao foram encontrados neste aparelho.'

let cached: Promise<StonePos> | undefined

async function selectStonePos(): Promise<StonePos> {
  if (nativeStonePos && (await nativeStonePos.isAvailable())) {
    return createStonePosDeeplink(nativeStonePos)
  }
  if (__DEV__) {
    const { createStonePosMock } = await import('./StonePosMock')
    return createStonePosMock()
  }
  throw new Error(UNAVAILABLE_MESSAGE)
}

export function getStonePos(): Promise<StonePos> {
  cached ??= selectStonePos().catch((error: unknown) => {
    cached = undefined
    throw error
  })
  return cached
}

// Value injected by the host app through StonePosConfig; undefined when the native module is absent.
export function getStonePosBuildEnvironment(): string | undefined {
  return nativeStonePos?.getConstants?.().buildEnvironment
}

export function resetStonePosForTests(): void {
  cached = undefined
}
