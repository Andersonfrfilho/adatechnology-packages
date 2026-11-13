/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import type { NotificationJob } from '@adatechnology/notification-contracts'

import { createBullMqQueue } from './bullmq'

function jobDouble(): NotificationJob {
  return {
    notificationId: '4d0f9a2e-6f8b-4f4a-9f2c-6c1c1b7a5e11',
    deliveryId: 'b7c2a1d0-3e5f-4a6b-8c9d-0e1f2a3b4c5d',
    companyId: '9f8e7d6c-5b4a-4392-8271-160504030201',
    channel: 'inbox',
    attempt: 1,
  } as NotificationJob
}

function queueDouble() {
  const calls: Array<{ name: string; data: NotificationJob; options?: Record<string, unknown> }> = []
  return {
    calls,
    queue: {
      async add(name: string, data: NotificationJob, options?: Record<string, unknown>): Promise<unknown> {
        calls.push({ name, data, options })
        return undefined
      },
      async close(): Promise<void> {},
    },
  }
}

describe('createBullMqQueue', () => {
  it('monta jobId sem `:`, que o BullMQ recusa em id customizado', async () => {
    const { calls, queue } = queueDouble()
    const job = jobDouble()

    await createBullMqQueue({ queue }).enqueue({ job })

    const jobId = calls[0]?.options?.jobId
    // A regra é do BullMQ: `:` separa as chaves dele no Redis, e `Job.create` lança
    // "Custom Id cannot contain :" antes de escrever nada. O enfileiramento acontece dentro da
    // operação de negócio que dispara o aviso, então a exceção não ficava contida na fila —
    // derrubava a operação inteira.
    expect(jobId).not.toContain(':')
    expect(jobId).toBe(`${job.deliveryId}_${job.attempt}`)
  })

  it('mantém o jobId estável para o mesmo par entrega/tentativa, e distinto entre tentativas', async () => {
    const { calls, queue } = queueDouble()
    const port = createBullMqQueue({ queue })
    const job = jobDouble()

    await port.enqueue({ job })
    await port.enqueue({ job })
    await port.enqueue({ job: { ...job, attempt: 2 } })

    expect(calls[0]?.options?.jobId).toBe(calls[1]?.options?.jobId)
    expect(calls[2]?.options?.jobId).not.toBe(calls[0]?.options?.jobId)
  })
})
