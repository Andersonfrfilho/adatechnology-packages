/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Integração real contra Postgres (T212, CA02/CA05/CA06) — prova o que o dublê em memória
 * (`testing/inMemoryRepositories.ts`) não alcança: os CHECKs e o `unique` parcial do banco
 * (`schema/schema.ts`), e a corrida de duas aberturas concorrentes.
 *
 * Mesmo padrão de `meta-whatsapp-module/src/repositories/SessionRepository.humanRequestedAt.integration.test.ts`
 * e `notification-module` (`bun-sql` + `drizzle-orm/bun-sql/migrator`): sem
 * `DRIZZLE_TEST_DATABASE_URL`/`DATABASE_URL`, a suíte inteira é pulada — Postgres não é
 * pré-requisito para `bun test` local.
 *
 * Limpeza: cada teste cria um `companyId` novo (`randomUUID()`), registrado em `companyIds`; o
 * `afterAll` apaga as linhas desses `companyId` em ordem de FK (attachments → uploads → reads →
 * unassigned → messages → participants → conversations) antes de fechar a conexão. Não há schema
 * recriado por teste — a instância inteira do Postgres é descartável (criada por `initdb` num
 * diretório de scratchpad só para esta task) e é derrubada no fim da sessão.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { SQL } from 'bun'
import { and, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import { migrate } from 'drizzle-orm/bun-sql/migrator'

import type { ClockPort, ConversationChannelPort } from '@adatechnology/conversation-contracts'

import type { ConversationDatabase } from './database.types'
import { runConversationMigrations } from './runMigrations'
import {
  conversationAttachments,
  conversationMessages,
  conversationParticipants,
  conversationReads,
  conversations,
  conversationUnassigned,
  conversationUploads,
} from './schema/schema'
import { createConversationModule, type ConversationModule } from './ConversationModule'

const databaseUrl = process.env.DRIZZLE_TEST_DATABASE_URL ?? process.env.DATABASE_URL
const describeWithDatabase = databaseUrl === undefined ? describe.skip : describe

if (databaseUrl === undefined) {
  console.warn(
    'conversation-module: DRIZZLE_TEST_DATABASE_URL/DATABASE_URL ausente — suíte de integração contra Postgres pulada.',
  )
}

function fixedClock(): ClockPort {
  return { now: () => new Date() }
}

function stubChannelPort(): ConversationChannelPort {
  return {
    async sendText() {
      return { providerMessageId: randomUUID() }
    },
    async sendAttachment() {
      return { providerMessageId: randomUUID() }
    },
  }
}

async function cleanupCompany(db: ConversationDatabase, companyId: string): Promise<void> {
  const conversationRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.companyId, companyId))
  const conversationIds = conversationRows.map((row) => row.id)
  const messageRows = conversationIds.length
    ? await db
        .select({ id: conversationMessages.id })
        .from(conversationMessages)
        .where(
          and(
            eq(conversationMessages.companyId, companyId),
            inArray(conversationMessages.conversationId, conversationIds),
          ),
        )
    : []
  const messageIds = messageRows.map((row) => row.id)

  if (messageIds.length) {
    await db.delete(conversationAttachments).where(inArray(conversationAttachments.messageId, messageIds))
  }
  await db.delete(conversationUploads).where(eq(conversationUploads.companyId, companyId))
  await db.delete(conversationReads).where(eq(conversationReads.companyId, companyId))
  await db.delete(conversationUnassigned).where(eq(conversationUnassigned.companyId, companyId))
  await db.delete(conversationMessages).where(eq(conversationMessages.companyId, companyId))
  await db.delete(conversationParticipants).where(eq(conversationParticipants.companyId, companyId))
  await db.delete(conversations).where(eq(conversations.companyId, companyId))
}

describeWithDatabase('conversation-module — integração contra Postgres real (T212)', () => {
  let sql: SQL
  let db: ConversationDatabase
  let module: ConversationModule
  const companyIds: string[] = []

  function newCompanyId(): string {
    const id = randomUUID()
    companyIds.push(id)
    return id
  }

  beforeAll(async () => {
    sql = new SQL(databaseUrl!)
    db = drizzle(sql) as unknown as ConversationDatabase
    await runConversationMigrations({ db, migrate: (target, config) => migrate(target as never, config) })

    module = createConversationModule({
      providers: {
        db,
        clock: fixedClock(),
        channels: { whatsapp: stubChannelPort() },
      },
    })
  })

  afterAll(async () => {
    for (const companyId of companyIds) {
      await cleanupCompany(db, companyId)
    }
    await sql.end()
  })

  describe('CA02 — abrir com e sem assunto, idempotência real', () => {
    test('abrir com assunto duas vezes pelo mesmo caso de uso devolve a mesma conversa', async () => {
      const companyId = newCompanyId()
      const subject = { subjectType: 'pedido', subjectId: randomUUID(), audience: 'sales' }
      const participant = { channel: 'whatsapp' as const, identifier: '5511900000001' }

      const first = await module.useCases.openConversation.execute({ companyId, participant, subject })
      const second = await module.useCases.openConversation.execute({ companyId, participant, subject })

      expect(second.id).toBe(first.id)
      const rows = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.companyId, companyId),
            eq(conversations.subjectType, subject.subjectType),
            eq(conversations.subjectId, subject.subjectId),
          ),
        )
      expect(rows).toHaveLength(1)
    })

    test('abrir sem assunto duas vezes pelo mesmo caso de uso devolve a mesma conversa por participante', async () => {
      const companyId = newCompanyId()
      const participant = { channel: 'whatsapp' as const, identifier: '5511900000002' }

      const first = await module.useCases.openConversation.execute({ companyId, participant })
      const second = await module.useCases.openConversation.execute({ companyId, participant })

      expect(second.id).toBe(first.id)
      const rows = await db.select().from(conversations).where(eq(conversations.companyId, companyId))
      expect(rows).toHaveLength(1)
    })

    test('o unique parcial do banco segura a conversa com assunto mesmo com duas aberturas concorrentes', async () => {
      const companyId = newCompanyId()
      const subject = { subjectType: 'pedido', subjectId: randomUUID(), audience: 'sales' }
      const participant = { channel: 'whatsapp' as const, identifier: '5511900000003' }

      // Duas conexões próprias, para as duas aberturas correrem em paralelo de verdade — numa
      // conexão só, o protocolo do Postgres serializa os round-trips e a corrida nunca aconteceria.
      const sqlA = new SQL(databaseUrl!)
      const sqlB = new SQL(databaseUrl!)
      try {
        const dbA = drizzle(sqlA) as unknown as ConversationDatabase
        const dbB = drizzle(sqlB) as unknown as ConversationDatabase
        const moduleA = createConversationModule({ providers: { db: dbA, clock: fixedClock(), channels: {} } })
        const moduleB = createConversationModule({ providers: { db: dbB, clock: fixedClock(), channels: {} } })

        const results = await Promise.allSettled([
          moduleA.useCases.openConversation.execute({ companyId, participant, subject }),
          moduleB.useCases.openConversation.execute({ companyId, participant, subject }),
        ])

        // Uma das duas corridas pode esbarrar no unique parcial do banco (ambas viram a mesma
        // ausência antes de qualquer commit) — o que a task prova é que nunca sobra mais de uma
        // linha, nunca que as duas sempre terminam com sucesso.
        const fulfilled = results.filter((result) => result.status === 'fulfilled')
        expect(fulfilled.length).toBeGreaterThanOrEqual(1)
      } finally {
        await sqlA.end()
        await sqlB.end()
      }

      const rows = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.companyId, companyId),
            eq(conversations.subjectType, subject.subjectType),
            eq(conversations.subjectId, subject.subjectId),
          ),
        )
      expect(rows).toHaveLength(1)
    })
  })

  describe('CA05 — status só avança, evento repetido não muda nada, CHECK por canal', () => {
    test('sent → delivered avança; delivered repetido não muda status_times', async () => {
      const companyId = newCompanyId()
      const conversation = await module.useCases.openConversation.execute({
        companyId,
        participant: { channel: 'whatsapp', identifier: '5511900000004' },
      })

      const sent = await module.useCases.sendMessage.execute({
        companyId,
        conversationId: conversation.id,
        channel: 'whatsapp',
        to: '5511900000004',
        bodyText: 'oi',
        automatic: true,
      })
      expect(sent.providerMessageId).toBeDefined()
      const providerMessageId = sent.providerMessageId!

      const afterSentEvent = await module.useCases.updateMessageStatus.execute({
        companyId,
        channel: 'whatsapp',
        providerMessageId,
        status: 'sent',
        at: new Date().toISOString(),
      })
      expect(afterSentEvent?.status).toBe('sent')

      const afterDelivered = await module.useCases.updateMessageStatus.execute({
        companyId,
        channel: 'whatsapp',
        providerMessageId,
        status: 'delivered',
        at: new Date().toISOString(),
      })
      expect(afterDelivered?.status).toBe('delivered')
      const deliveredAt = afterDelivered?.statusTimes.delivered
      expect(deliveredAt).toBeDefined()

      // Evento repetido do provedor — mesmo status, horário diferente: nada muda.
      const repeated = await module.useCases.updateMessageStatus.execute({
        companyId,
        channel: 'whatsapp',
        providerMessageId,
        status: 'delivered',
        at: new Date(Date.now() + 60_000).toISOString(),
      })
      expect(repeated?.status).toBe('delivered')
      expect(repeated?.statusTimes.delivered).toBe(deliveredAt!)

      const [row] = await db
        .select()
        .from(conversationMessages)
        .where(and(eq(conversationMessages.companyId, companyId), eq(conversationMessages.id, sent.id)))
        .limit(1)
      expect(row?.status).toBe('delivered')
      expect(row?.statusTimes.queued).toBeDefined()
      expect(row?.statusTimes.delivered).toBe(deliveredAt!)
    })

    test('o CHECK recusa status read no canal email — parâmetro de bind não passaria por aqui', async () => {
      const companyId = newCompanyId()
      const conversation = await module.useCases.openConversation.execute({
        companyId,
        participant: { channel: 'email', identifier: 'cliente@example.com' },
      })

      const insert = db.insert(conversationMessages).values({
        companyId,
        conversationId: conversation.id,
        channel: 'email',
        direction: 'outbound',
        automatic: true,
        bodyText: 'oi',
        status: 'read',
        statusTimes: {},
      })

      await expect(Promise.resolve(insert)).rejects.toBeDefined()
    })

    test('o CHECK recusa status sent no canal portal', async () => {
      const companyId = newCompanyId()
      const conversation = await module.useCases.openConversation.execute({
        companyId,
        participant: { channel: 'portal', identifier: randomUUID() },
      })

      const insert = db.insert(conversationMessages).values({
        companyId,
        conversationId: conversation.id,
        channel: 'portal',
        direction: 'outbound',
        automatic: true,
        bodyText: 'oi',
        status: 'sent',
        statusTimes: {},
      })

      await expect(Promise.resolve(insert)).rejects.toBeDefined()
    })
  })

  describe('CA06 — mensagem recebida com duas conversas abertas cai em não atribuídas', () => {
    test('participante com duas conversas abertas e sem referência de resposta cai na fila; repetição não duplica; atribuição manual grava tudo junto', async () => {
      const companyId = newCompanyId()
      const identifier = '5511900000005'

      const conversationOne = await module.useCases.openConversation.execute({
        companyId,
        participant: { channel: 'whatsapp', identifier },
        subject: { subjectType: 'pedido', subjectId: randomUUID(), audience: 'sales' },
      })
      const conversationTwo = await module.useCases.openConversation.execute({
        companyId,
        participant: { channel: 'whatsapp', identifier },
        subject: { subjectType: 'pedido', subjectId: randomUUID(), audience: 'support' },
      })
      expect(conversationOne.id).not.toBe(conversationTwo.id)

      const providerMessageId = randomUUID()
      const attributed = await module.useCases.attributeInboundMessage.execute({
        companyId,
        channel: 'whatsapp',
        identifier,
        bodyText: 'preciso de ajuda',
        providerMessageId,
      })
      expect(attributed.kind).toBe('unassigned')
      if (attributed.kind !== 'unassigned') throw new Error('esperava unassigned')
      const entryId = attributed.entry.id

      // A mesma recebida de novo (mesmo id do provedor) não duplica — volta o mesmo item.
      const repeated = await module.useCases.attributeInboundMessage.execute({
        companyId,
        channel: 'whatsapp',
        identifier,
        bodyText: 'preciso de ajuda',
        providerMessageId,
      })
      expect(repeated.kind).toBe('unassigned')
      if (repeated.kind !== 'unassigned') throw new Error('esperava unassigned')
      expect(repeated.entry.id).toBe(entryId)

      const unassignedRows = await db
        .select()
        .from(conversationUnassigned)
        .where(
          and(
            eq(conversationUnassigned.companyId, companyId),
            eq(conversationUnassigned.providerMessageId, providerMessageId),
          ),
        )
      expect(unassignedRows).toHaveLength(1)

      const assignedByUserId = randomUUID()
      const assignment = await module.useCases.assignUnassignedToConversation.execute({
        companyId,
        unassignedId: entryId,
        conversationId: conversationOne.id,
        assignedByUserId,
      })

      expect(assignment.message.conversationId).toBe(conversationOne.id)
      expect(assignment.entry.assignedMessageId).toBe(assignment.message.id)
      expect(assignment.entry.assignedByUserId).toBe(assignedByUserId)
      expect(assignment.entry.assignedAt).not.toBeNull()

      const [row] = await db
        .select()
        .from(conversationUnassigned)
        .where(and(eq(conversationUnassigned.companyId, companyId), eq(conversationUnassigned.id, entryId)))
        .limit(1)
      expect(row?.assignedMessageId).toBe(assignment.message.id)
      expect(row?.assignedByUserId).toBe(assignedByUserId)
      expect(row?.assignedAt).not.toBeNull()

      const [messageRow] = await db
        .select()
        .from(conversationMessages)
        .where(and(eq(conversationMessages.companyId, companyId), eq(conversationMessages.id, assignment.message.id)))
        .limit(1)
      expect(messageRow?.conversationId).toBe(conversationOne.id)
    })
  })

  describe('Isolamento entre empresas', () => {
    test('a conversa de outra companyId nunca aparece nas leituras', async () => {
      const companyOne = newCompanyId()
      const companyTwo = newCompanyId()
      const identifier = '5511900000006'

      await module.useCases.openConversation.execute({
        companyId: companyOne,
        participant: { channel: 'whatsapp', identifier },
      })

      const foundInCompanyTwo = await module.useCases.openConversation.execute({
        companyId: companyTwo,
        participant: { channel: 'whatsapp', identifier },
      })

      const rowsForCompanyOne = await db.select().from(conversations).where(eq(conversations.companyId, companyOne))
      const rowsForCompanyTwo = await db.select().from(conversations).where(eq(conversations.companyId, companyTwo))
      expect(rowsForCompanyOne).toHaveLength(1)
      expect(rowsForCompanyTwo).toHaveLength(1)
      expect(rowsForCompanyOne[0]?.id).not.toBe(rowsForCompanyTwo[0]?.id)
      expect(foundInCompanyTwo.companyId).toBe(companyTwo)
    })
  })

  describe('CHECK conversations_subject_pair_check', () => {
    test('recusa assunto pela metade — subjectType sem subjectId', async () => {
      const companyId = newCompanyId()

      const insert = db.insert(conversations).values({
        companyId,
        subjectType: 'pedido',
        subjectId: null,
      })

      await expect(Promise.resolve(insert)).rejects.toBeDefined()
    })
  })
})
