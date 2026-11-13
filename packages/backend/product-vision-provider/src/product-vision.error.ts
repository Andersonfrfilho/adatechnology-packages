/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export class VisionError extends Error {
  constructor(
    message: string,
    public readonly engine: string,
    /** Falha de infraestrutura (timeout, modelo nao carregado) merece nova tentativa; formato nao. */
    public readonly retriable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'VisionError'
  }
}

/**
 * A dependencia opcional do engine nao esta instalada. Erro proprio porque a mensagem tem de
 * dizer o que instalar: um `Cannot find module` cru manda o operador procurar no lugar errado.
 */
export class VisionEngineUnavailableError extends VisionError {
  constructor(
    engine: string,
    public readonly missingPackage: string,
    options?: { cause?: unknown },
  ) {
    super(`O engine "${engine}" precisa do pacote "${missingPackage}", que nao esta instalado.`, engine, false, options)
    this.name = 'VisionEngineUnavailableError'
  }
}

export function isVisionError(value: unknown): value is VisionError {
  return value instanceof VisionError
}
