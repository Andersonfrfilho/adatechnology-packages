/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { DEFAULT_USER_LABELS as labels } from './workspace/labels'
import { TEAM_DEFAULT_PAGE_SIZE, compareBy, type TeamSort } from './useTeam'
import { TEAM_PASSWORD_MIN_LENGTH } from './TeamMemberForm'

describe('contrato da tela de equipe', () => {
  /**
   * A tela inteira some quando a `UserApi` nao traz `listTeam`. Isso e verificado no tipo — os tres
   * metodos sao opcionais — e este teste guarda a intencao contra alguem torna-los obrigatorios:
   * seria quebrar todo consumidor atual do pacote.
   */
  it('o minimo de senha acompanha o do servidor', () => {
    expect(TEAM_PASSWORD_MIN_LENGTH).toBe(12)
  })

  it('a pagina padrao cobre uma equipe inteira sem paginar', () => {
    expect(TEAM_DEFAULT_PAGE_SIZE).toBeGreaterThanOrEqual(20)
  })

  it('o rotulo de pagina tem os dois marcadores que a tela substitui', () => {
    expect(labels.teamPageOf).toContain('{current}')
    expect(labels.teamPageOf).toContain('{last}')
  })

  /** Rotulo vazio vira botao sem texto, e so aparece em producao. */
  it('nenhum rotulo de equipe nasce vazio', () => {
    const vazios = Object.entries(labels)
      .filter(([key]) => key.startsWith('team'))
      .filter(([, value]) => value.trim() === '')

    expect(vazios).toEqual([])
  })

  it('os rotulos de equipe existem em numero suficiente para a tela inteira', () => {
    const team = Object.keys(labels).filter((key) => key.startsWith('team'))

    expect(team.length).toBeGreaterThanOrEqual(20)
  })
})

describe('busca e selecao em lote', () => {
  /** `web.md` §7: o botao de limpar so aparece quando ha o que limpar. */
  it('os rotulos de busca e limpar existem', () => {
    expect(labels.teamSearch).toBeTruthy()
    expect(labels.teamClearFilters).toBeTruthy()
  })

  /** "Nada cadastrado" pede criar; "nada encontrado" pede afrouxar a busca. */
  it('vazio e sem-resultado sao mensagens diferentes', () => {
    expect(labels.teamEmpty).not.toBe(labels.teamNoResults)
  })

  it('o rotulo de contagem tem o marcador que a tela substitui', () => {
    expect(labels.teamSelectedCount).toContain('{count}')
  })

  /** Selecionar linha precisa de rotulo proprio: `Selecionar` sozinho, repetido por linha, nao diz quem. */
  it('a selecao por linha tem rotulo, para o leitor de tela distinguir as linhas', () => {
    expect(labels.teamSelectRow).toBeTruthy()
    expect(labels.teamSelectAll).not.toBe(labels.teamSelectRow)
  })

  it('as duas acoes em lote sao distinguiveis', () => {
    expect(labels.teamBulkActivate).not.toBe(labels.teamBulkDeactivate)
  })
})

describe('ordenacao', () => {
  const membros = [
    { id: '1', name: 'Carla', email: 'c@x.com', role: 'member', isActive: false },
    { id: '2', name: 'Ana', email: 'a@x.com', role: 'admin', isActive: true },
    { id: '3', name: 'Bruno', email: 'b@x.com', role: 'member', isActive: true },
  ] as const

  function ordenar(sort: TeamSort): readonly string[] {
    return [...membros].sort(compareBy(sort)).map((membro) => membro.name)
  }

  it('sobe e desce pelo mesmo campo', () => {
    expect(ordenar({ field: 'name', direction: 'asc' })).toEqual(['Ana', 'Bruno', 'Carla'])
    expect(ordenar({ field: 'name', direction: 'desc' })).toEqual(['Carla', 'Bruno', 'Ana'])
  })

  it('ordena situacao por ativo, e nao pelo texto de true e false', () => {
    // Alfabeticamente "false" < "true"; o inativo viria primeiro, que e o contrario do util.
    expect(ordenar({ field: 'isActive', direction: 'asc' })[2]).toBe('Carla')
  })
})
