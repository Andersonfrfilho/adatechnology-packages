/**
 * Conversas de partida do preview. Cobrem o espaço de estados que a inbox precisa saber desenhar —
 * bot em atendimento, cliente esperando humano, conversa já assumida por atendente, conversa com
 * áudio — porque estado que não aparece em fixture é estado que ninguém testa.
 */

import type { MessagePayload } from '../types'
import type { ConversationDocument, ConversationSummary } from '../providers/types'

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
  {
    // Cobre TODO tipo que o composer aceita (DEFAULT_ACCEPTED_FILE_TYPES: image/*, video/*,
    // audio/*, .pdf, .doc, .docx, .xls, .xlsx, .zip) mais sticker. Existe para que cada ramo do
    // MediaRenderer e cada ícone/cor do FileIcon apareçam em algum lugar — ramo sem fixture é ramo
    // que ninguém olha até quebrar em produção.
    id: '5511944443333',
    whatsappNumber: '5511944443333',
    clientName: 'Rita Documentos',
    lastContent: 'segue a planilha do pedido',
    lastDirection: 'inbound',
    lastAt: at('15:10:00'),
    lastInboundAt: at('15:10:00'),
    mode: 'human',
    assignedUserId: 'agent-1',
    waitingHuman: false,
    unread: 3,
    currentState: 'human_handling',
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
  // Um tipo por mensagem, na ordem em que o MediaRenderer os trata.
  '5511944443333': [
    {
      id: 'fixture-doc-image',
      type: 'image',
      mediaId: 'preview-image-1',
      mimeType: 'image/png',
      caption: 'foto da prateleira',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:00:00'),
    },
    {
      id: 'fixture-doc-video',
      type: 'video',
      mediaId: 'preview-video-1',
      mimeType: 'video/mp4',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:01:00'),
    },
    {
      id: 'fixture-doc-audio',
      type: 'audio',
      mediaId: 'preview-audio-2',
      mimeType: 'audio/ogg',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:02:00'),
    },
    {
      id: 'fixture-doc-sticker',
      type: 'sticker',
      mediaId: 'preview-sticker-1',
      mimeType: 'image/webp',
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:03:00'),
    },
    // Os cinco ramos do FileIcon: pdf, doc, xls, zip e o genérico do fallback.
    {
      id: 'fixture-doc-pdf',
      type: 'document',
      uploadId: 'preview/documentos/nota-fiscal.pdf',
      filename: 'nota-fiscal.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 184_320,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:04:00'),
    },
    {
      id: 'fixture-doc-docx',
      type: 'document',
      uploadId: 'preview/documentos/contrato.docx',
      filename: 'contrato.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 42_112,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:05:00'),
    },
    {
      id: 'fixture-doc-doc',
      type: 'document',
      uploadId: 'preview/documentos/procuracao.doc',
      filename: 'procuracao.doc',
      mimeType: 'application/msword',
      sizeBytes: 31_744,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:06:00'),
    },
    {
      id: 'fixture-doc-xlsx',
      type: 'document',
      uploadId: 'preview/documentos/pedido.xlsx',
      filename: 'pedido.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 15_872,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:07:00'),
    },
    {
      id: 'fixture-doc-xls',
      type: 'document',
      uploadId: 'preview/documentos/tabela-antiga.xls',
      filename: 'tabela-antiga.xls',
      mimeType: 'application/vnd.ms-excel',
      sizeBytes: 9_216,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:08:00'),
    },
    {
      id: 'fixture-doc-zip',
      type: 'document',
      uploadId: 'preview/documentos/comprovantes.zip',
      filename: 'comprovantes.zip',
      mimeType: 'application/zip',
      sizeBytes: 2_355_200,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:09:00'),
    },
    {
      // Extensão fora do EXTENSION_STYLE: garante que o ícone genérico cinza também apareça.
      id: 'fixture-doc-generic',
      type: 'document',
      uploadId: 'preview/documentos/lista-compras.txt',
      filename: 'lista-compras.txt',
      mimeType: 'text/plain',
      sizeBytes: 1_024,
      direction: 'inbound',
      sender: 'customer',
      timestamp: at('15:10:00'),
    },
  ],
}

/**
 * A biblioteca de arquivos da conversa, como o backend a devolveria. Deriva das mensagens de
 * documento acima em vez de repetir os dados: fixture duplicada divergiria na primeira edição, e o
 * painel passaria a mostrar arquivo que a thread não tem.
 */
export const PREVIEW_DOCUMENTS: Readonly<Record<string, readonly ConversationDocument[]>> = {
  '5511944443333': (PREVIEW_MESSAGES['5511944443333'] ?? [])
    .filter((message) => message.type === 'document')
    .map((message) => ({
      id: message.uploadId ?? message.id,
      filename: message.filename ?? message.id,
      mimeType: message.mimeType ?? 'application/octet-stream',
      sizeBytes: message.sizeBytes ?? 0,
      source: message.sender,
      linkedAt: message.timestamp,
    })),
}
