/**
 * Guarda a correlação das subqueries da lista de conversas.
 *
 * O bug que motivou este arquivo não dá erro: dentro da lista de seleção o drizzle renderiza
 * `${sessions.companyId}` como um `"company_id"` sem qualificação de tabela. Dentro do
 * subselect esse nome resolve para a coluna de `m`, virando `m.company_id = m.company_id`
 * (sempre verdadeiro) e `m.session_id = m.id` (nunca) — a query roda, devolve NULL, e a inbox
 * mostra prévia vazia e zero não lidas para sempre.
 *
 * Renderiza o SQL em vez de consultar banco: o defeito é de renderização, e travá-lo assim não
 * exige Postgres no pipeline.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { conversationSummaryProjection, sessionContextPatch } from './SessionRepository'

const dialect = new PgDialect()

function render(
  expression: (typeof conversationSummaryProjection)[keyof typeof conversationSummaryProjection],
): string {
  return dialect.sqlToQuery(expression as never).sql
}

describe('correlação das subqueries da lista de conversas', () => {
  const rendered = Object.fromEntries(
    Object.entries(conversationSummaryProjection).map(([key, expression]) => [key, render(expression)]),
  ) as Record<keyof typeof conversationSummaryProjection, string>

  it('qualifica a tabela externa na correlação', () => {
    for (const sql of Object.values(rendered)) {
      expect(sql).toContain('"meta_whatsapp"."sessions".company_id')
      expect(sql).toContain('"meta_whatsapp"."sessions".id')
    }
  })

  // Estas duas formas são exatamente o que a renderização não-qualificada produzia. Se voltarem,
  // a query passa a comparar a mensagem consigo mesma e nunca casa.
  it('não compara a mensagem consigo mesma', () => {
    for (const sql of Object.values(rendered)) {
      expect(sql).not.toContain('m.company_id = "company_id"')
      expect(sql).not.toContain('m.session_id = "id"')
    }
  })

  it('lê da tabela de mensagens do módulo', () => {
    for (const sql of Object.values(rendered)) {
      expect(sql).toContain('"meta_whatsapp"."messages"')
    }
  })

  it('projeta prévia, direção e contagem', () => {
    expect(rendered.lastContent).toContain('m.content')
    expect(rendered.lastDirection).toContain('m.direction')
    expect(rendered.unread).toContain('count(*)')
  })

  it('conta como não lida a conversa que nunca foi aberta', () => {
    expect(rendered.unread).toContain('last_agent_read_at is null')
    expect(rendered.unread).toContain(`m.direction = 'inbound'`)
  })
})

// O context é o ponto de extensão oficial de estado de sessão por produto (S-05). A mescla precisa
// acontecer no banco: read-modify-write no host perde escrita quando duas mensagens do mesmo
// cliente são processadas em paralelo.
describe('mescla parcial do context da sessão', () => {
  const query = dialect.sqlToQuery(sessionContextPatch({ step: 2 }) as never)

  it('mescla em vez de substituir', () => {
    expect(query.sql).toContain('"meta_whatsapp"."sessions"."context" ||')
  })

  // Sem o cast o parâmetro chega como text e o `||` vira concatenação de string: o context deixa
  // de ser objeto e nenhuma leitura posterior acusa erro.
  it('faz cast do patch para jsonb', () => {
    expect(query.sql).toContain('::jsonb')
  })

  it('manda o patch como parâmetro, não interpolado', () => {
    expect(query.params).toEqual(['{"step":2}'])
  })
})
