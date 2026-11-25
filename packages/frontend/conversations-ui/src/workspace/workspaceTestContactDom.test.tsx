/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Simulador sem conversa selecionada: o host cria um contato de teste e o painel abre direto.
 */

import { act } from 'react'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { setupDom, wait, type DomHarness } from '../domHarness.test-helper'
import { ConversationsProvider } from '../providers/ConversationsProvider'
import { createMockConversationsApi } from '../preview/createMockConversationsApi'
import { createMockSSEProvider } from '../preview/createMockSSEProvider'
import { createPreviewStore } from '../preview/previewStore'
import { PREVIEW_CONVERSATIONS, PREVIEW_MESSAGES } from '../preview/previewFixtures'
import { ConversationsWorkspace, type ConversationsWorkspaceSimulator } from './ConversationsWorkspace'

let harness: DomHarness

beforeAll(async () => {
  harness = await setupDom()
})

afterAll(() => harness.teardown())

function mountWorkspace(simulator: ConversationsWorkspaceSimulator) {
  const store = createPreviewStore({ conversations: [], messages: {} })
  return harness.mount(
    <ConversationsProvider api={createMockConversationsApi({ store, latencyMs: 0 })} sse={createMockSSEProvider({ store })}>
      <ConversationsWorkspace simulator={simulator} />
    </ConversationsProvider>,
  )
}

function newContactButton(container: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.getAttribute('aria-label') === 'Novo contato de teste',
  )
}

describe('novo contato de teste', () => {
  it('sem createTestContact o botão não existe', async () => {
    const { container, unmount } = mountWorkspace({ transports: { whatsapp: () => ({ sendText: async () => {}, sendReply: async () => {} }) } })
    await wait(5)

    expect(newContactButton(container)).toBeUndefined()
    unmount()
  })

  it('abre o simulador sem conversa selecionada, com o contato do host', async () => {
    const sent: string[] = []
    const handles: string[] = []
    const { container, unmount } = mountWorkspace({
      createTestContact: () => ({ handle: '05511900001234' }),
      transports: {
        whatsapp: ({ handle }) => {
          handles.push(handle)
          return { sendText: async (text) => void sent.push(text), sendReply: async () => {} }
        },
      },
    })
    await wait(5)

    await act(async () => {
      newContactButton(container)?.click()
    })
    await wait(5)

    const panel = container.querySelector('.cv-simulator-panel')
    expect(panel).not.toBeNull()
    expect(panel?.textContent).toContain('Contato de teste 1234')
    expect(handles).toContain('05511900001234')
    unmount()
  })
})

describe('rótulos do painel de contexto', () => {
  it('o workspace repassa contextLabels ao painel', async () => {
    const store = createPreviewStore({ conversations: PREVIEW_CONVERSATIONS, messages: PREVIEW_MESSAGES })
    const first = PREVIEW_CONVERSATIONS[0]
    const { container, unmount } = harness.mount(
      <ConversationsProvider api={createMockConversationsApi({ store, latencyMs: 0 })} sse={createMockSSEProvider({ store })}>
        <ConversationsWorkspace
          initialConversationId={first?.id}
          contextEntriesOf={() => [{ key: 'date', label: 'Data', value: undefined, status: 'pending' }]}
          contextLabels={{ title: 'Dados da reserva', notCollected: 'ainda não informado' }}
        />
      </ConversationsProvider>,
    )
    await wait(20)

    expect(container.textContent).toContain('Dados da reserva')
    unmount()
  })
})
