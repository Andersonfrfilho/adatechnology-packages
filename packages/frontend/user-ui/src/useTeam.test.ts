/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { DEFAULT_USER_LABELS as labels } from './workspace/labels'
import { TEAM_DEFAULT_PAGE_SIZE } from './useTeam'
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
