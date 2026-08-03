/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Auditoria de PII (T4.12) — `security.md` §1: proibido logar PII em QUALQUER nível, inclusive
 * `debug`, e proibido persistir endereço em claro.
 *
 * A defesa não é disciplina de quem escreve o log: é o desenho (o módulo nunca recebe o endereço
 * a não ser no instante do envio, e só guarda máscara/HMAC). Este teste trava esse desenho.
 *
 * O caminho feliz **não produz log nenhum** — medido. Por isso `expectNoPiiInLogs` exige linha
 * gravada antes de conferir o conteúdo: sem essa guarda, o asserto de log passava por vacuidade e
 * o teste anunciava uma cobertura que não tinha. Auditar log exige um caminho que loga, e é o que
 * o terceiro bloco exercita.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { SendNotificationUseCase } from './use-cases/SendNotification.use-case'
import { applyDeliveryOutcome } from './use-cases/applyDeliveryOutcome'
import { createDefaultTemplateRenderer } from './shared/DefaultTemplateRenderer'
import {
  buildDeviceRow,
  buildTemplateRow,
  createInMemoryDeliveries,
  createInMemoryDevices,
  createInMemoryNotifications,
  createInMemoryPreferences,
  createInMemorySuppressions,
  createInMemoryTemplates,
  createRecordingQueue,
} from './testing/inMemoryRepositories'

const COMPANY_ID = randomUUID()
const USER_ID = randomUUID()

const PII = {
  email: 'maria.silva@example.com',
  phone: '5511987654321',
  pushToken: 'ExponentPushToken[super-secreto]',
  messageBody: 'Maria, seu pedido de R$ 250,00 saiu para entrega na Rua das Flores 123',
}

function createRecordingLogger() {
  const lines: string[] = []
  const record = (level: string) => (message: string, meta?: Record<string, unknown>) => {
    lines.push(`${level} ${message} ${meta ? JSON.stringify(meta) : ''}`)
  }
  return { lines, debug: record('debug'), info: record('info'), warn: record('warn'), error: record('error') }
}

function expectNoPii(haystack: string): void {
  expect(haystack).not.toContain(PII.email)
  expect(haystack).not.toContain(PII.phone)
  expect(haystack).not.toContain(PII.pushToken)
  expect(haystack).not.toContain(PII.messageBody)
  // Também o local-part do e-mail sozinho — mascarar só o domínio não seria mascarar.
  expect(haystack).not.toContain('maria.silva')
}

/**
 * Conferir log vazio não prova nada. A guarda transforma em falha o caso em que ninguém logou —
 * que é exatamente como o asserto de log deste arquivo passava sendo decorativo.
 */
function expectNoPiiInLogs(lines: readonly string[]): void {
  expect(lines.length).toBeGreaterThan(0)
  expectNoPii(lines.join('\n'))
}

describe('auditoria de PII — envio completo', () => {
  it('não vaza e-mail, telefone, token nem corpo em log de nenhum nível, e não persiste em claro', async () => {
    const logger = createRecordingLogger()
    const notifications = createInMemoryNotifications()
    const deliveries = createInMemoryDeliveries()
    const device = buildDeviceRow({ companyId: COMPANY_ID, userId: USER_ID, token: PII.pushToken })

    const useCase = new SendNotificationUseCase(
      {
        notifications,
        deliveries,
        templates: createInMemoryTemplates([
          buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'inbox', body: PII.messageBody }),
          buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'email', body: PII.messageBody }),
          buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'push', body: PII.messageBody }),
        ]),
        preferences: createInMemoryPreferences([]),
        suppressions: createInMemorySuppressions([]),
        devices: createInMemoryDevices([device]),
        recipientResolver: {
          async resolve() {
            return { email: PII.email, phone: PII.phone }
          },
        },
        templateRenderer: createDefaultTemplateRenderer(),
        channels: {
          push: { driver: 'fcm', send: async () => ({ outcome: 'sent' }) },
          email: { driver: 'resend', send: async () => ({ outcome: 'sent' }) },
        },
        queue: createRecordingQueue(),
        logger,
      } as never,
      { defaultLocale: 'pt-BR', suppressionHmacKey: 'chave' },
    )

    await useCase.execute({
      companyId: COMPANY_ID,
      recipientUserId: USER_ID,
      category: 'order_status',
      templateKey: 'order.shipped',
      channels: ['inbox', 'email', 'push'],
    })

    // O caminho feliz não loga NADA, e isso é a propriedade — não um acaso. Afirmar o zero é o
    // que impede alguém acrescentar um `info` com o endereço e este arquivo seguir verde.
    expect(logger.lines).toHaveLength(0)

    // `deliveries` é a tabela que acompanha cada envio — só máscara, nunca endereço.
    const serializedDeliveries = JSON.stringify(deliveries.rows)
    expect(serializedDeliveries).not.toContain(PII.email)
    expect(serializedDeliveries).not.toContain(PII.phone)
    expect(serializedDeliveries).not.toContain(PII.pushToken)
    expect(serializedDeliveries).toContain('@example.com') // a máscara preserva o domínio, de propósito
  })

  it('o job da fila carrega só referências opacas — nunca conteúdo nem endereço', async () => {
    const queue = createRecordingQueue()
    const notifications = createInMemoryNotifications()
    const deliveries = createInMemoryDeliveries()

    const useCase = new SendNotificationUseCase(
      {
        notifications,
        deliveries,
        templates: createInMemoryTemplates([
          buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'email', body: PII.messageBody }),
        ]),
        preferences: createInMemoryPreferences([]),
        suppressions: createInMemorySuppressions([]),
        devices: createInMemoryDevices([]),
        recipientResolver: {
          async resolve() {
            return { email: PII.email, phone: PII.phone }
          },
        },
        templateRenderer: createDefaultTemplateRenderer(),
        channels: { email: { driver: 'resend', send: async () => ({ outcome: 'sent' }) } },
        queue,
      } as never,
      { defaultLocale: 'pt-BR', suppressionHmacKey: 'chave' },
    )

    await useCase.execute({
      companyId: COMPANY_ID,
      recipientUserId: USER_ID,
      category: 'order_status',
      templateKey: 'order.shipped',
      channels: ['email'],
    })

    const serializedJobs = JSON.stringify(queue.enqueued)
    expectNoPii(serializedJobs)
    // Só id de notificação, de delivery, de empresa, canal e tentativa (worker.md).
    expect(Object.keys(queue.enqueued[0]?.job ?? {}).sort()).toEqual([
      'attempt',
      'channel',
      'companyId',
      'deliveryId',
      'notificationId',
    ])
  })
})

describe('auditoria de PII — supressão', () => {
  it('a linha de supressão guarda hash, e o log de falha não repete o endereço', async () => {
    const logger = createRecordingLogger()
    const notifications = createInMemoryNotifications()
    const deliveries = createInMemoryDeliveries()
    const suppressions = createInMemorySuppressions([])

    const notification = await notifications.create({
      companyId: COMPANY_ID,
      recipientUserId: USER_ID,
      category: 'order_status',
      templateKey: 'order.shipped',
      title: 'Pedido',
      body: PII.messageBody,
    })
    const delivery = await deliveries.create({
      notificationId: notification.id,
      companyId: COMPANY_ID,
      channel: 'email',
      status: 'queued',
    })

    await applyDeliveryOutcome({
      dependencies: {
        notifications,
        deliveries,
        devices: createInMemoryDevices([]),
        suppressions,
        queue: createRecordingQueue(),
        logger,
      } as never,
      config: { defaultLocale: 'pt-BR', suppressionHmacKey: 'chave', retryAttempts: 3, retryBackoffSeconds: 30 },
      delivery,
      notification,
      outcome: { outcome: 'invalid_target', errorCode: 'smtp_550' },
      address: PII.email,
      now: new Date('2026-08-02T15:00:00.000Z'),
    })

    expect(suppressions.rows).toHaveLength(1)
    expectNoPii(JSON.stringify(suppressions.rows))
    // Suprimir também não loga: o endereço está em escopo aqui (veio em `address`), e é o momento
    // em que um log de conveniência vazaria com mais facilidade.
    expect(logger.lines).toHaveLength(0)
  })
})

describe('auditoria de PII — o caminho que de fato loga', () => {
  /**
   * Os blocos acima afirmam que o caminho feliz não loga. Isso deixa a auditoria de log sem
   * cobertura nenhuma — e foi assim que este arquivo passou meses anunciando o que não verificava.
   *
   * `realtime.publish` que falha é o log mais exposto do módulo: dispara no meio do fan-out, com
   * o destinatário resolvido e o conteúdo renderizado em escopo. Se algum campo de PII fosse
   * escapar para um log, seria aqui.
   */
  it('falha do realtime loga referência opaca, com o endereço e o corpo em escopo', async () => {
    const logger = createRecordingLogger()
    const notifications = createInMemoryNotifications()
    const deliveries = createInMemoryDeliveries()

    const useCase = new SendNotificationUseCase(
      {
        notifications,
        deliveries,
        templates: createInMemoryTemplates([
          buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'inbox', body: PII.messageBody }),
        ]),
        preferences: createInMemoryPreferences([]),
        suppressions: createInMemorySuppressions([]),
        devices: createInMemoryDevices([]),
        recipientResolver: {
          async resolve() {
            return { email: PII.email, phone: PII.phone }
          },
        },
        templateRenderer: createDefaultTemplateRenderer(),
        channels: {},
        queue: createRecordingQueue(),
        realtime: {
          async publish() {
            // Erro de broker realista: fala do canal, não do conteúdo.
            throw new Error('NOCONN Redis connection to notifications:6379 failed')
          },
        },
        logger,
      } as never,
      { defaultLocale: 'pt-BR', suppressionHmacKey: 'chave' },
    )

    await useCase.execute({
      companyId: COMPANY_ID,
      recipientUserId: USER_ID,
      category: 'order_status',
      templateKey: 'order.shipped',
      channels: ['inbox'],
    })

    expectNoPiiInLogs(logger.lines)
    expect(logger.lines.join('\n')).toContain('notification.realtime_publish_failed')
  })

  /**
   * O que o módulo controla é o **meta** que ele monta. `error: String(error)` carrega texto de
   * porta injetada pelo host, e a redação desse texto é do logger do host (`security.md` §1,
   * "a redação vive no logger"). O que este teste trava é a fronteira: nenhum campo montado pelo
   * módulo pode ser destinatário ou conteúdo.
   */
  it('o meta montado pelo módulo só tem id opaco — nem título, nem destinatário', async () => {
    const logger = createRecordingLogger()

    const useCase = new SendNotificationUseCase(
      {
        notifications: createInMemoryNotifications(),
        deliveries: createInMemoryDeliveries(),
        templates: createInMemoryTemplates([
          buildTemplateRow({ companyId: COMPANY_ID, key: 'order.shipped', channel: 'inbox', body: PII.messageBody }),
        ]),
        preferences: createInMemoryPreferences([]),
        suppressions: createInMemorySuppressions([]),
        devices: createInMemoryDevices([]),
        recipientResolver: {
          async resolve() {
            return { email: PII.email, phone: PII.phone }
          },
        },
        templateRenderer: createDefaultTemplateRenderer(),
        channels: {},
        queue: createRecordingQueue(),
        realtime: {
          async publish() {
            throw new Error('indisponível')
          },
        },
        logger,
      } as never,
      { defaultLocale: 'pt-BR', suppressionHmacKey: 'chave' },
    )

    await useCase.execute({
      companyId: COMPANY_ID,
      recipientUserId: USER_ID,
      category: 'order_status',
      templateKey: 'order.shipped',
      channels: ['inbox'],
    })

    const meta = JSON.parse(logger.lines[0]!.slice(logger.lines[0]!.indexOf('{')))
    expect(Object.keys(meta).sort()).toEqual(['error', 'notificationId'])
  })
})
