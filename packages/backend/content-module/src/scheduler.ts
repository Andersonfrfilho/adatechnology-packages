/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { LoggerPort } from '@adatechnology/content-contracts'

import type { ContentModule } from './ContentModule'

export const DEFAULT_SCHEDULER_INTERVAL_MS = 60_000

export type StartContentSchedulerParams = {
  readonly module: ContentModule
  /** Padrão: 1 minuto. */
  readonly intervalMs?: number
  readonly logger?: LoggerPort
}

/**
 * Chama `publishDue` num intervalo, com guarda de execução única neste processo: se um ciclo ainda
 * está rodando, o próximo tick é pulado em vez de empilhar. Entre instâncias, quem garante é o
 * `FOR UPDATE SKIP LOCKED` do store. Erro de um ciclo é logado e o seguinte tenta de novo.
 * Devolve a função que para o agendador (chame no desligamento).
 */
export function startContentScheduler(params: StartContentSchedulerParams): () => void {
  let isRunning = false
  const tick = async (): Promise<void> => {
    if (isRunning) return
    isRunning = true
    try {
      await params.module.useCases.publishDue.execute()
    } catch (error) {
      params.logger?.error('content-module: ciclo do agendador falhou', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      isRunning = false
    }
  }
  const timer = setInterval(() => void tick(), params.intervalMs ?? DEFAULT_SCHEDULER_INTERVAL_MS)
  timer.unref?.()
  void tick()
  return () => clearInterval(timer)
}
