/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF3, D6: a máquina de status só avança. Porta exata da regra de `message-status.policy.ts` da
 * 183 — mesma ladder por canal, mesma janela de falha (`failableUntil`), mesmo tratamento de evento
 * atrasado (o horário que faltava entra, o status não retrocede). A diferença: aqui o que o canal
 * **alcança** vem da tabela de capacidades da T105 (`getChannelCapabilities`), não de uma lista
 * duplicada — é o que faz `read` no e-mail e `sent` no portal serem recusados pela mesma fonte que a
 * tela usa (D3).
 *
 * A idempotência por `(canal, id do provedor)` é do banco (T202, `unique` da 183): esta função é
 * pura e nunca vê o id do provedor — o módulo decide, antes de chamá-la, se o evento é repetido, e
 * ela decide, dado o evento aceito, se o status muda.
 */
import { describe, expect, it } from 'bun:test'

import { advanceDeliveryStatus, type DeliveryStatusState } from './deliveryStatus'

const T0 = '2026-09-26T10:00:00.000Z'
const T1 = '2026-09-26T10:05:00.000Z'
const T2 = '2026-09-26T10:10:00.000Z'

function stateAt(status: DeliveryStatusState['status'], statusTimes: DeliveryStatusState['statusTimes'] = {}) {
  return { status, statusTimes }
}

describe('advanceDeliveryStatus', () => {
  it('avança na ordem e guarda o horário ISO de cada transição', () => {
    const queued = stateAt('queued', { queued: T0 })
    const sent = advanceDeliveryStatus({
      channel: 'whatsapp',
      current: queued,
      event: { status: 'sent', at: T1 },
    })
    expect(sent).toEqual({
      changed: true,
      status: 'sent',
      statusTimes: { queued: T0, sent: T1 },
    })
  })

  it('nunca retrocede: delivered depois de read não desfaz o read', () => {
    const read = stateAt('read', { queued: T0, sent: T1, delivered: T1, read: T2 })
    const result = advanceDeliveryStatus({
      channel: 'whatsapp',
      current: read,
      event: { status: 'delivered', at: '2026-09-26T10:20:00.000Z' },
    })
    expect(result.changed).toBe(false)
    expect(result.status).toBe('read')
    expect(result.statusTimes).toEqual(read.statusTimes)
  })

  it('evento repetido é idempotente: changed false, nada muda', () => {
    const delivered = stateAt('delivered', { queued: T0, sent: T1, delivered: T2 })
    const result = advanceDeliveryStatus({
      channel: 'email',
      current: delivered,
      event: { status: 'delivered', at: '2026-09-26T10:30:00.000Z' },
    })
    expect(result).toEqual({
      changed: false,
      reason: 'duplicate',
      status: 'delivered',
      statusTimes: delivered.statusTimes,
    })
  })

  it('evento fora de ordem avança para o status maior sem inventar o horário que faltou', () => {
    const queued = stateAt('queued', { queued: T0 })
    const result = advanceDeliveryStatus({
      channel: 'whatsapp',
      current: queued,
      event: { status: 'read', at: T2 },
    })
    expect(result.changed).toBe(true)
    expect(result.status).toBe('read')
    expect(result.statusTimes).toEqual({ queued: T0, read: T2 })
    expect(result.statusTimes.delivered).toBeUndefined()
    expect(result.statusTimes.sent).toBeUndefined()
  })

  it('falha só vale até a janela do canal (failableUntil): falha depois de delivered é stale', () => {
    const delivered = stateAt('delivered', { queued: T0, sent: T1, delivered: T2 })
    const result = advanceDeliveryStatus({
      channel: 'email',
      current: delivered,
      event: { status: 'bounced', at: '2026-09-26T10:30:00.000Z' },
    })
    expect(result).toEqual({
      changed: false,
      reason: 'stale',
      status: 'delivered',
      statusTimes: delivered.statusTimes,
    })
  })

  it('falha dentro da janela muda o status (falha do e-mail antes de sent)', () => {
    const queued = stateAt('queued', { queued: T0 })
    const result = advanceDeliveryStatus({
      channel: 'email',
      current: queued,
      event: { status: 'bounced', at: T1 },
    })
    expect(result).toEqual({ changed: true, status: 'bounced', statusTimes: { queued: T0, bounced: T1 } })
  })

  it('read no e-mail é recusado pela tabela de capacidades da T105', () => {
    const delivered = stateAt('delivered', { queued: T0, sent: T1, delivered: T2 })
    const result = advanceDeliveryStatus({
      channel: 'email',
      current: delivered,
      event: { status: 'read', at: '2026-09-26T10:30:00.000Z' },
    })
    expect(result).toEqual({
      changed: false,
      reason: 'unsupported',
      status: 'delivered',
      statusTimes: delivered.statusTimes,
    })
  })

  it('sent no portal é recusado pela tabela de capacidades da T105', () => {
    const deliveredPortal = stateAt('delivered', { delivered: T0 })
    const result = advanceDeliveryStatus({
      channel: 'portal',
      current: deliveredPortal,
      event: { status: 'sent', at: T1 },
    })
    expect(result).toEqual({
      changed: false,
      reason: 'unsupported',
      status: 'delivered',
      statusTimes: deliveredPortal.statusTimes,
    })
  })
})
