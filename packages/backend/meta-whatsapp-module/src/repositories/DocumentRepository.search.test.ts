/**
 * Guarda a busca da biblioteca de documentos.
 *
 * Renderiza o SQL em vez de consultar banco, pelo mesmo motivo do `SessionRepository.test.ts`: o
 * que se quer travar é a forma do predicado (quais colunas entram e com que valor), e isso não
 * exige Postgres no pipeline.
 */

import { describe, expect, it } from 'bun:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

import { companyDocumentSearch } from './DocumentRepository'

const dialect = new PgDialect()

function render(expression: SQL): { sql: string; params: unknown[] } {
  const query = dialect.sqlToQuery(expression)
  return { sql: query.sql, params: query.params }
}

describe('companyDocumentSearch', () => {
  it('não filtra quando o termo está vazio ou só tem espaço', () => {
    expect(companyDocumentSearch(undefined)).toBeUndefined()
    expect(companyDocumentSearch('')).toBeUndefined()
    expect(companyDocumentSearch('   ')).toBeUndefined()
  })

  // Um termo com letra e dígito vira dois predicados diferentes: o nome guarda o termo inteiro, o
  // telefone só a parte numérica — "nota2024" acha o arquivo e também a conversa do número 2024.
  it('busca por nome do arquivo e por telefone na mesma palavra', () => {
    const { sql, params } = render(companyDocumentSearch('nota2024')!)

    expect(sql).toContain('filename')
    expect(sql).toContain('whatsapp_number')
    expect(sql).toContain(' or ')
    expect(params).toEqual(['%nota2024%', '%2024%'])
  })

  // O caso que motivou a mudança: o atendente copia "+55 (11) 94444-3333" da tela e cola na busca.
  // Sem tirar a pontuação, o `ilike` compararia com "5511944443333" e não casaria nada.
  it('compara o telefone só pelos dígitos, mantendo a pontuação no nome do arquivo', () => {
    const { params } = render(companyDocumentSearch('+55 (11) 94444-3333')!)

    expect(params).toEqual(['%+55 (11) 94444-3333%', '%5511944443333%'])
  })

  it('aceita pedaço do número', () => {
    const { params } = render(companyDocumentSearch('94444')!)

    expect(params).toEqual(['%94444%', '%94444%'])
  })

  // Sem dígito nenhum, `%%` no telefone casaria toda conversa e a busca por nome pararia de filtrar.
  it('não gera predicado de telefone para termo sem dígitos', () => {
    const { sql, params } = render(companyDocumentSearch('contrato.pdf')!)

    expect(sql).not.toContain('whatsapp_number')
    expect(sql).not.toContain(' or ')
    expect(params).toEqual(['%contrato.pdf%'])
  })
})
