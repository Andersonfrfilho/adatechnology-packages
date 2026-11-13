/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { WhatsAppRejectionError, WhatsAppTemplateDuplicateError } from '@adatechnology/meta-graph-core'

import { WhatsAppTemplateProvider } from './WhatsAppTemplateProvider'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function buildProvider(): WhatsAppTemplateProvider {
  return new WhatsAppTemplateProvider({ accessToken: 'fixture-token', wabaId: 'waba-1' })
}

function mockJsonResponseOnce(body: unknown, status = 200): { requestUrl: string; requestInit: RequestInit }[] {
  const calls: { requestUrl: string; requestInit: RequestInit }[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ requestUrl: String(input), requestInit: init ?? {} })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return calls
}

describe('WhatsAppTemplateProvider.listTemplates', () => {
  test('summarizes each template, counting body variables and deriving a short id', async () => {
    mockJsonResponseOnce({
      data: [
        {
          id: '1234567890123456',
          name: 'confirmacao_agendamento',
          status: 'APPROVED',
          category: 'UTILITY',
          language: 'pt_BR',
          components: [{ type: 'BODY', text: 'Olá {{1}}, seu horário é {{2}}.' }],
        },
      ],
    })
    const provider = buildProvider()

    const [summary] = await provider.listTemplates()

    expect(summary).toMatchObject({
      id: '1234567890123456',
      name: 'confirmacao_agendamento',
      displayName: 'confirmacao agendamento',
      shortId: '90123456',
      variableCount: 2,
      bodyText: 'Olá {{1}}, seu horário é {{2}}.',
    })
  })
})

describe('WhatsAppTemplateProvider.createTemplate', () => {
  test('sends header, body, and footer components in order', async () => {
    const calls = mockJsonResponseOnce({ id: 'template-1', status: 'PENDING' })
    const provider = buildProvider()

    const result = await provider.createTemplate({
      name: 'lembrete',
      category: 'UTILITY',
      headerType: 'TEXT',
      headerText: 'Lembrete',
      bodyText: 'Seu horário é amanhã.',
      footerText: 'Responda para confirmar.',
    })

    expect(result).toEqual({ id: 'template-1', shortId: 'mplate-1', status: 'PENDING' })
    const [{ requestInit }] = calls
    const payload = JSON.parse(String(requestInit.body)) as { components: Array<{ type: string }> }
    expect(payload.components.map((component) => component.type)).toEqual(['HEADER', 'BODY', 'FOOTER'])
  })

  test('maps a duplicate-template rejection into WhatsAppTemplateDuplicateError', async () => {
    mockJsonResponseOnce({ error: { code: 100, message: 'Duplicate template name' } }, 400)
    const provider = buildProvider()

    await expect(
      provider.createTemplate({ name: 'lembrete', category: 'UTILITY', bodyText: 'texto' }),
    ).rejects.toBeInstanceOf(WhatsAppTemplateDuplicateError)
  })

  test('does not remap unrelated rejections', async () => {
    mockJsonResponseOnce({ error: { code: 100, message: 'Invalid parameter' } }, 400)
    const provider = buildProvider()

    await expect(
      provider.createTemplate({ name: 'lembrete', category: 'UTILITY', bodyText: 'texto' }),
    ).rejects.toBeInstanceOf(WhatsAppRejectionError)
  })
})

describe('WhatsAppTemplateProvider.deleteTemplate', () => {
  test('sends the template name and id as query parameters', async () => {
    const calls = mockJsonResponseOnce({ success: true })
    const provider = buildProvider()

    await provider.deleteTemplate({ id: 'template-1', name: 'lembrete' })

    const [{ requestUrl, requestInit }] = calls
    expect(requestUrl).toBe('https://graph.facebook.com/v21.0/waba-1/message_templates?name=lembrete&hsm_id=template-1')
    expect(requestInit.method).toBe('DELETE')
  })
})
