/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  getConstants(): { buildEnvironment: string }
  isAvailable(): Promise<boolean>
  getDeviceInfo(): Promise<string>
  pay(paramsJson: string): Promise<string>
  cancel(paramsJson: string): Promise<string>
  print(contentJson: string, optionsJson: string): Promise<string>
  consumeOrphanReturns(): Promise<string>
  abandonPendingOperation(): Promise<void>
  setKeepScreenOn(enabled: boolean): Promise<void>
}

export default TurboModuleRegistry.get<Spec>('StonePos')
