/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T204: prova que os dublês em memória de `testing/` satisfazem as portas de `ports.ts` — o
 * requisito de forma que a task pede. A prova de que a implementação Drizzle atende a mesma
 * porta é de tipo (o `implements` na classe já falha o `check` se divergir); a prova contra
 * Postgres real é a T212.
 */
import { describe, expect, it } from 'bun:test'

import {
  createInMemoryAttachments,
  createInMemoryConversations,
  createInMemoryMessages,
  createInMemoryQuickReplies,
  createInMemoryReads,
  createInMemoryUnassigned,
} from '../testing/inMemoryRepositories'
import type {
  AttachmentRepositoryPort,
  ConversationRepositoryPort,
  MessageRepositoryPort,
  QuickReplyRepositoryPort,
  ReadRepositoryPort,
  UnassignedRepositoryPort,
} from './ports'

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'

describe('as portas do módulo são satisfeitas pelos dublês em memória', () => {
  it('ConversationRepositoryPort: abre, acha por assunto e por participante aberto', async () => {
    const port: ConversationRepositoryPort = createInMemoryConversations()
    const conversation = await port.create({ companyId: COMPANY_ID, subjectType: 'lead', subjectId: 'lead-1' })
    const bySubject = await port.findBySubject({
      companyId: COMPANY_ID,
      subjectType: 'lead',
      subjectId: 'lead-1',
      audience: null,
    })
    expect(bySubject?.id).toBe(conversation.id)

    const withoutSubject = await port.create({ companyId: COMPANY_ID })
    await port.addParticipant({
      companyId: COMPANY_ID,
      conversationId: withoutSubject.id,
      channel: 'whatsapp',
      identifier: '+5511999990000',
    })
    const byParticipant = await port.findOpenByParticipant({
      companyId: COMPANY_ID,
      channel: 'whatsapp',
      identifier: '+5511999990000',
    })
    expect(byParticipant?.id).toBe(withoutSubject.id)
  })

  it('MessageRepositoryPort: cria, acha por id do provedor e pagina por cursor', async () => {
    const port: MessageRepositoryPort = createInMemoryMessages()
    const message = await port.create({
      companyId: COMPANY_ID,
      conversationId: 'conv-1',
      channel: 'whatsapp',
      direction: 'outbound',
      automatic: true,
      status: 'queued',
      providerMessageId: 'prov-1',
    })
    const found = await port.findByProviderMessageId({
      companyId: COMPANY_ID,
      channel: 'whatsapp',
      providerMessageId: 'prov-1',
    })
    expect(found?.id).toBe(message.id)

    const page = await port.list({ companyId: COMPANY_ID, conversationId: 'conv-1', perPage: 10 })
    expect(page.rows).toHaveLength(1)
  })

  it('AttachmentRepositoryPort: grava anexo e upload em dois passos', async () => {
    const port: AttachmentRepositoryPort = createInMemoryAttachments()
    const upload = await port.createUpload({
      companyId: COMPANY_ID,
      conversationId: 'conv-1',
      channel: 'email',
      requestedByUserId: 'user-1',
      bucket: 'bucket',
      objectKey: 'key-1',
      declaredContentType: 'image/png',
      declaredSizeBytes: 10,
      expiresAt: new Date(),
    })
    expect(upload.status).toBe('pending')

    const attached = await port.markUploadAttached({ companyId: COMPANY_ID, id: upload.id, attachedAt: new Date() })
    expect(attached?.status).toBe('attached')
  })

  it('ReadRepositoryPort: upsert por (empresa, conversa, usuário)', async () => {
    const port: ReadRepositoryPort = createInMemoryReads()
    const first = await port.upsert({
      companyId: COMPANY_ID,
      conversationId: 'conv-1',
      userId: 'user-1',
      lastReadMessageId: 'msg-1',
      readAt: new Date(),
    })
    const second = await port.upsert({
      companyId: COMPANY_ID,
      conversationId: 'conv-1',
      userId: 'user-1',
      lastReadMessageId: 'msg-2',
      readAt: new Date(),
    })
    expect(second.id).toBe(first.id)
    expect(second.lastReadMessageId).toBe('msg-2')
  })

  it('UnassignedRepositoryPort: lista candidatas abertas e atribui', async () => {
    const port: UnassignedRepositoryPort = createInMemoryUnassigned()
    const entry = await port.create({
      companyId: COMPANY_ID,
      channel: 'email',
      senderAddress: 'cliente@example.com',
      receivedAt: new Date(),
    })
    const openCandidates = await port.listOpenBySender({
      companyId: COMPANY_ID,
      channel: 'email',
      senderAddress: 'cliente@example.com',
    })
    expect(openCandidates).toHaveLength(1)

    const assigned = await port.assign({
      companyId: COMPANY_ID,
      id: entry.id,
      assignedMessageId: 'msg-1',
      assignedByUserId: 'user-1',
      assignedAt: new Date(),
    })
    expect(assigned?.assignedMessageId).toBe('msg-1')

    const afterAssignment = await port.listOpenBySender({
      companyId: COMPANY_ID,
      channel: 'email',
      senderAddress: 'cliente@example.com',
    })
    expect(afterAssignment).toHaveLength(0)
  })

  it('QuickReplyRepositoryPort: CRUD simples por público', async () => {
    const port: QuickReplyRepositoryPort = createInMemoryQuickReplies()
    const reply = await port.create({ companyId: COMPANY_ID, audience: 'customer', bodyText: 'Olá!', position: 0 })
    const list = await port.listByAudience({ companyId: COMPANY_ID, audience: 'customer' })
    expect(list).toHaveLength(1)

    const updated = await port.update({ companyId: COMPANY_ID, id: reply.id, active: false })
    expect(updated?.active).toBe(false)
  })
})
