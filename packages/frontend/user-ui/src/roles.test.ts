/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  buildDefaultTeamRoles,
  resolveTeamRole,
  withCurrentRole,
  DEFAULT_TEAM_ROLE_VALUE,
  type TeamRoleOption,
} from './roles'
import { DEFAULT_USER_LABELS } from './workspace/labels'

const QUICKCART_ROLES: readonly TeamRoleOption[] = [
  { value: 'atendente', label: 'Atendente' },
  { value: 'separador', label: 'Separador' },
  { value: 'admin', label: 'Administrador', tone: 'accent' },
]

describe('buildDefaultTeamRoles', () => {
  it('mantém o par histórico, na ordem em que o select já os mostrava', () => {
    const roles = buildDefaultTeamRoles(DEFAULT_USER_LABELS)

    expect(roles.map((role) => role.value)).toEqual([
      DEFAULT_TEAM_ROLE_VALUE.MEMBER,
      DEFAULT_TEAM_ROLE_VALUE.ADMIN,
    ])
  })

  it('segue os rótulos, para continuar traduzível por `labels`', () => {
    const roles = buildDefaultTeamRoles({ ...DEFAULT_USER_LABELS, teamRoleAdmin: 'Owner' })

    expect(roles.find((role) => role.value === 'admin')?.label).toBe('Owner')
  })

  it('só o admin sai destacado, como a listagem já o desenhava', () => {
    const roles = buildDefaultTeamRoles(DEFAULT_USER_LABELS)

    expect(roles.find((role) => role.value === 'admin')?.tone).toBe('accent')
    expect(roles.find((role) => role.value === 'member')?.tone).toBeUndefined()
  })
})

describe('resolveTeamRole', () => {
  it('devolve o rótulo declarado pelo host', () => {
    expect(resolveTeamRole(QUICKCART_ROLES, 'separador').label).toBe('Separador')
  })

  it('papel desconhecido NÃO some: aparece com o valor cru', () => {
    // Esconder a linha tiraria da tela quem tem acesso que o host não sabe explicar.
    expect(resolveTeamRole(QUICKCART_ROLES, 'motorista')).toEqual({
      value: 'motorista',
      label: 'motorista',
    })
  })

  it('papel desconhecido não herda destaque de ninguém', () => {
    expect(resolveTeamRole(QUICKCART_ROLES, 'motorista').tone).toBeUndefined()
  })
})

describe('withCurrentRole', () => {
  it('não mexe na lista quando o papel atual já está nela', () => {
    expect(withCurrentRole(QUICKCART_ROLES, 'admin')).toBe(QUICKCART_ROLES)
  })

  it('acrescenta o papel atual quando ele não está entre as opções', () => {
    /*
     * Sem isto, o `<select>` de edição abriria já marcando outra coisa: salvar só o NOME de um
     * motorista o rebaixaria a atendente em silêncio, sem ninguém tocar no campo de papel.
     */
    const options = withCurrentRole(QUICKCART_ROLES, 'motorista')

    expect(options.map((role) => role.value)).toEqual(['atendente', 'separador', 'admin', 'motorista'])
  })
})
