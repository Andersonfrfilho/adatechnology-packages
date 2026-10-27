/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { MessageRepository } from '../repositories/MessageRepository'

export type CountInboundLocationsParams = {
  readonly companyId: string
  /** Só entra o que chegou antes deste instante; o que veio depois já nasceu redigido. */
  readonly receivedBefore: Date
}

export type CountInboundLocationsResult = {
  /** Linhas que a redação alcança. */
  readonly counted: number
  /** Localizações com `payload` escalar string (gravação antiga do driver): a redação não as toca. */
  readonly unreachable: number
}

export type RedactInboundLocationsParams = CountInboundLocationsParams & {
  /** Teto de linhas por passada (padrão 500). Quem chama repete até `redacted` zerar. */
  readonly batchSize?: number
}

export type RedactInboundLocationsResult = {
  readonly redacted: number
}

const DEFAULT_BATCH_SIZE = 500

/** Quantas localizações gravadas a redação alcançaria, sem escrever nada. */
export class CountInboundLocationsUseCase {
  constructor(private readonly messageRepository: MessageRepository) {}

  async execute(params: CountInboundLocationsParams): Promise<CountInboundLocationsResult> {
    return this.messageRepository.countInboundLocations(params)
  }
}

/**
 * Tira `payload.location` e o rótulo das mensagens de entrada já gravadas — o legado de quem ligou
 * `features.redactInboundLocation` depois de a coordenada ter entrado. UMA passada por chamada:
 * o host faz o laço, e cada passada é uma transação curta.
 */
export class RedactInboundLocationsUseCase {
  constructor(private readonly messageRepository: MessageRepository) {}

  async execute(params: RedactInboundLocationsParams): Promise<RedactInboundLocationsResult> {
    return this.messageRepository.redactInboundLocations({
      ...params,
      batchSize: params.batchSize ?? DEFAULT_BATCH_SIZE,
    })
  }
}
