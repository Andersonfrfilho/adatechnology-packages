/**
 * Conversas de partida do preview. Cobrem o espaço de estados que a inbox precisa saber desenhar —
 * bot em atendimento, cliente esperando humano, conversa já assumida por atendente, conversa com
 * áudio — porque estado que não aparece em fixture é estado que ninguém testa.
 */

import type { MessagePayload } from '../types'
import type { ConversationSummary } from '../providers/types'

// Datas fixas: fixture com data relativa ao relógio faz o mesmo cenário renderizar diferente a
// cada execução, e separadores de dia deixam de ser verificáveis.
const BASE_DAY = '2026-07-26'

function at(time: string): string {
  return `${BASE_DAY}T${time}.000Z`
}

export const PREVIEW_CONVERSATIONS: readonly ConversationSummary[] = [
  {
    id: '5511988887777',
    whatsappNumber: '5511988887777',
    clientName: 'Marina Alves',
    lastContent: 'quero 2kg de arroz e um óleo',
    lastDirection: 'inbound',
    lastAt: at('14:32:00'),
    lastInboundAt: at('14:32:00'),
    mode: 'bot',
    assignedUserId: null,
    waitingHuman: false,
    unread: 2,
    currentState: 'list_review',
  },
  {
    id: '5511977776666',
    whatsappNumber: '5511977776666',
    clientName: 'Diego Prado',
    lastContent: 'preciso falar com alguém',
    lastDirection: 'inbound',
    lastAt: at('14:20:00'),
    lastInboundAt: at('14:20:00'),
    mode: 'bot',
    assignedUserId: null,
    waitingHuman: true,
    unread: 1,
    currentState: 'awaiting_human',
  },
  {
    id: '5511966665555',
    whatsappNumber: '5511966665555',
    clientName: 'Sofia Nakamura',
    lastContent: 'já separei seu pedido, confere?',
    lastDirection: 'outbound',
    lastAt: at('13:58:00'),
    lastInboundAt: at('13:50:00'),
    mode: 'human',
    assignedUserId: 'agent-1',
    waitingHuman: false,
    unread: 0,
    currentState: 'human_handling',
  },
  {
    id: '5511955554444',
    whatsappNumber: '5511955554444',
    lastContent: 'Áudio',
    lastDirection: 'inbound',
    lastAt: at('13:31:00'),
    lastInboundAt: at('13:31:00'),
    mode: 'bot',
    assignedUserId: null,
    waitingHuman: false,
    unread: 1,
    currentState: 'list_import',
  },
]

export const PREVIEW_MESSAGES: Readonly<Record<string, readonly MessagePayload[]>> = {
  '5511988887777': [
    {
      id: 'fixture-1',
      type: 'text',
      content: 'oi, boa tarde',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('14:30:00'),
    },
    {
      id: 'fixture-2',
      type: 'text',
      content: 'Boa tarde! Me manda sua lista de compras que eu monto o carrinho.',
      direction: 'outbound',
      sender: 'bot',
      timestamp: at('14:30:30'),
      status: 'read',
    },
    {
      id: 'fixture-3',
      type: 'text',
      content: 'quero 2kg de arroz e um óleo',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('14:32:00'),
    },
  ],
  '5511977776666': [
    {
      id: 'fixture-4',
      type: 'text',
      content: 'esse valor do frete está certo?',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('14:19:00'),
    },
    {
      id: 'fixture-5',
      type: 'text',
      content: 'preciso falar com alguém',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('14:20:00'),
    },
  ],
  '5511966665555': [
    {
      id: 'fixture-6',
      type: 'text',
      content: 'consegue trocar o leite integral por desnatado?',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('13:50:00'),
    },
    {
      id: 'fixture-7',
      type: 'text',
      content: 'já separei seu pedido, confere?',
      direction: 'outbound',
      sender: 'agent',
      timestamp: at('13:58:00'),
      status: 'delivered',
      agentName: 'Ana',
    },
  ],
  '5511955554444': [
    {
      id: 'fixture-8',
      type: 'audio',
      mediaId: 'preview-audio-1',
      mimeType: 'audio/ogg',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('13:31:00'),
    },
  ],
}
