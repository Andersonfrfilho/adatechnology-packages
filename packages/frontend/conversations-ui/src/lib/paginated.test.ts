import { describe, expect, it } from 'bun:test'
import { conversationsOf, documentsOf, totalOf } from './paginated'
import type { ConversationDocument, ConversationSummary } from '../providers/types'

const conversation = { id: '1', whatsappNumber: '5511900000000' } as ConversationSummary
const document = { id: 'd1', filename: 'contrato.pdf' } as ConversationDocument

describe('normalização de lista ou página', () => {
  // As duas formas existem porque o contrato aceita as duas: array puro é o retorno original, e
  // implementações antigas continuam válidas. Um consumidor que só tratasse uma delas quebraria
  // em runtime, não no compilador.
  it('aceita o array puro do contrato original', () => {
    expect(conversationsOf([conversation])).toEqual([conversation])
    expect(documentsOf([document])).toEqual([document])
  })

  it('desembrulha a forma paginada', () => {
    expect(conversationsOf({ conversations: [conversation], total: 42 })).toEqual([conversation])
    expect(documentsOf({ documents: [document], total: 7 })).toEqual([document])
  })

  it('usa o total do servidor quando ele vem, e o tamanho da página quando não vem', () => {
    // A distinção importa: com array puro não dá para saber se a página é a última, então o
    // melhor palpite honesto é o que se tem em mãos.
    expect(totalOf({ conversations: [conversation], total: 42 })).toBe(42)
    expect(totalOf([conversation])).toBe(1)
  })

  it('trata página vazia sem confundir com ausência de dados', () => {
    expect(conversationsOf({ conversations: [], total: 0 })).toEqual([])
    expect(totalOf({ conversations: [], total: 0 })).toBe(0)
  })
})
