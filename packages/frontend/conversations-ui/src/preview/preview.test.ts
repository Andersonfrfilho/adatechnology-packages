import { describe, expect, it } from 'bun:test'
import { createMockConversationsApi } from './createMockConversationsApi'
import { createMockSSEProvider } from './createMockSSEProvider'
import { PREVIEW_CONVERSATIONS, PREVIEW_MESSAGES } from './previewFixtures'
import { createPreviewStore, type PreviewStore } from './previewStore'
import { DEFAULT_PREVIEW_SCRIPT } from './startPreviewScript'

function createStore(): PreviewStore {
  return createPreviewStore({ conversations: PREVIEW_CONVERSATIONS, messages: PREVIEW_MESSAGES })
}

const WAITING_CONVERSATION_ID = '5511977776666'
const BOT_CONVERSATION_ID = '5511988887777'

describe('previewStore', () => {
  it('filtra a fila de espera humana', () => {
    const store = createStore()

    const waiting = store.listConversations({ waitingHuman: true })

    expect(waiting.map((conversation) => conversation.id)).toEqual([WAITING_CONVERSATION_ID])
  })

  it('busca por nome e por número', () => {
    const store = createStore()

    expect(store.listConversations({ search: 'marina' })).toHaveLength(1)
    expect(store.listConversations({ search: '9777' })).toHaveLength(1)
  })

  it('assumir a conversa apaga a espera por humano', () => {
    const store = createStore()

    store.setMode({ conversationId: WAITING_CONVERSATION_ID, mode: 'human', assignedUserId: 'agent-2' })
    const conversation = store.listConversations().find((item) => item.id === WAITING_CONVERSATION_ID)

    expect(conversation?.mode).toBe('human')
    expect(conversation?.assignedUserId).toBe('agent-2')
    expect(conversation?.waitingHuman).toBe(false)
  })

  it('mensagem recebida incrementa não-lidas e markRead zera', () => {
    const store = createStore()
    const before = store.listConversations().find((item) => item.id === BOT_CONVERSATION_ID)?.unread ?? 0

    store.appendMessage({
      conversationId: BOT_CONVERSATION_ID,
      content: 'e o troco?',
      direction: 'inbound',
      sender: 'customer',
    })
    const after = store.listConversations().find((item) => item.id === BOT_CONVERSATION_ID)?.unread

    expect(after).toBe(before + 1)

    store.markRead(BOT_CONVERSATION_ID)
    expect(store.listConversations().find((item) => item.id === BOT_CONVERSATION_ID)?.unread).toBe(0)
  })
})

describe('createMockSSEProvider', () => {
  // Paridade com o servidor: o evento `message` é ping, não entrega de dados. Se este teste
  // começar a exigir `content`, o mock passou a mentir sobre o que a produção envia.
  it('entrega evento message como ping, sem conteúdo, com data serializada', () => {
    const store = createStore()
    const sse = createMockSSEProvider({ store })
    const source = sse.connectConversationStream(BOT_CONVERSATION_ID)
    const received: string[] = []

    source.addEventListener('message', (event) => received.push(event.data as string))
    store.appendMessage({
      conversationId: BOT_CONVERSATION_ID,
      content: 'oi',
      direction: 'inbound',
      sender: 'customer',
    })

    expect(received).toHaveLength(1)
    expect(JSON.parse(received[0] ?? '{}')).toEqual({ direction: 'inbound', sender: 'customer' })
  })

  it('emite mode-changed e data-changed nos canais certos', () => {
    const store = createStore()
    const sse = createMockSSEProvider({ store })
    const conversationEvents: string[] = []
    const globalEvents: string[] = []

    sse
      .connectConversationStream(WAITING_CONVERSATION_ID)
      .addEventListener('mode-changed', () => conversationEvents.push('mode-changed'))
    sse.connectGlobalStream().addEventListener('data-changed', () => globalEvents.push('data-changed'))

    store.setMode({ conversationId: WAITING_CONVERSATION_ID, mode: 'human', assignedUserId: 'agent-2' })

    expect(conversationEvents).toEqual(['mode-changed'])
    expect(globalEvents).toEqual(['data-changed'])
  })

  // A regressão que isto tranca: sem desassinar do store no close, cada remontagem de componente
  // deixaria um listener preso e a mesma mensagem chegaria duplicada na UI.
  it('desassina do store ao fechar o stream', () => {
    const store = createStore()
    const sse = createMockSSEProvider({ store })
    const source = sse.connectConversationStream(BOT_CONVERSATION_ID)
    const received: string[] = []

    source.addEventListener('message', (event) => received.push(event.data as string))
    source.close()
    store.appendMessage({
      conversationId: BOT_CONVERSATION_ID,
      content: 'oi',
      direction: 'inbound',
      sender: 'customer',
    })

    expect(received).toHaveLength(0)
  })
})

describe('createMockConversationsApi', () => {
  // Modela o fluxo real: o ping avisa, o refetch traz o dado. É o compartilhamento de store que
  // faz os dois concordarem — com estados separados, o ping anunciaria algo que a query não vê.
  it('ping do SSE e refetch da API contam a mesma história', async () => {
    const store = createStore()
    const api = createMockConversationsApi({ store, latencyMs: 0 })
    const sse = createMockSSEProvider({ store })
    const pings: unknown[] = []

    sse.connectConversationStream(BOT_CONVERSATION_ID).addEventListener('message', (event) => {
      pings.push(JSON.parse(event.data as string))
    })

    await api.sendMessage(BOT_CONVERSATION_ID, 'já separei aqui')
    const messages = await api.fetchMessages(BOT_CONVERSATION_ID)

    expect(pings).toEqual([{ direction: 'outbound', sender: 'agent' }])
    expect(messages.at(-1)?.content).toBe('já separei aqui')
    expect(messages.at(-1)?.sender).toBe('agent')
  })

  it('pagina e filtra pela mesma regra do store', async () => {
    const store = createStore()
    const api = createMockConversationsApi({ store, latencyMs: 0 })

    const firstPage = await api.fetchConversations({ page: 1, limit: 2 })
    const waiting = await api.fetchConversations({ waitingHuman: true })

    expect(firstPage).toHaveLength(2)
    expect(waiting.every((conversation) => conversation.waitingHuman)).toBe(true)
  })

  it('markRead zera as não-lidas vistas pela lista', async () => {
    const store = createStore()
    const api = createMockConversationsApi({ store, latencyMs: 0 })

    await api.markRead(BOT_CONVERSATION_ID)
    const conversations = await api.fetchConversations()

    expect(conversations.find((item) => item.id === BOT_CONVERSATION_ID)?.unread).toBe(0)
  })
})

describe('roteiro padrão', () => {
  // O roteiro é o que faz a inbox deixar de ser tela estática; se algum passo apontar para uma
  // conversa que não existe nas fixtures, ele passa a ser no-op silencioso.
  it('todos os passos alteram o estado das conversas das fixtures', () => {
    const store = createStore()
    const before = JSON.stringify(store.listConversations())

    for (const step of DEFAULT_PREVIEW_SCRIPT) step(store)

    expect(JSON.stringify(store.listConversations())).not.toBe(before)
    expect(store.listMessages(WAITING_CONVERSATION_ID).at(-1)?.sender).toBe('agent')
  })
})
