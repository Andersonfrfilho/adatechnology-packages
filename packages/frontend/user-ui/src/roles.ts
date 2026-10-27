/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os papéis que a tela de equipe oferece.
 *
 * O `user-module` guarda `role` como string livre, de propósito — há teste lá garantindo que nenhum
 * enum de papel saia do pacote, porque papel é vocabulário do PRODUTO. A tela de equipe, porém,
 * oferecia dois valores fixos no `<select>`: `member` e `admin`. Um host com separador, atendente e
 * motorista não conseguia cadastrar ninguém por ela, e o servidor aceitaria os três sem reclamar.
 *
 * Esta é a porta que faltava. Sem `roles`, o comportamento é exatamente o de antes.
 */

import type { UserLabels } from './workspace/labels'

/** Só `accent` e `neutral`: o papel distingue, não sinaliza saúde — verde e cinza-apagado são de estado. */
export type TeamRoleTone = 'accent' | 'neutral'

export type TeamRoleOption = {
  /** O que vai para a api. É o valor cru de `role`, e o host é quem o define. */
  readonly value: string
  /** O que a pessoa lê. */
  readonly label: string
  /** Destaque na listagem. Ausente = `neutral`. */
  readonly tone?: TeamRoleTone
}

export const DEFAULT_TEAM_ROLE_VALUE = {
  MEMBER: 'member',
  ADMIN: 'admin',
} as const

/**
 * O par histórico, montado a partir dos rótulos para continuar traduzível por `labels`.
 *
 * É função e não constante porque os rótulos são valores de execução: um host que troca
 * `teamRoleAdmin` precisa ver a troca aqui também.
 */
export function buildDefaultTeamRoles(labels: UserLabels): readonly TeamRoleOption[] {
  return [
    { value: DEFAULT_TEAM_ROLE_VALUE.MEMBER, label: labels.teamRoleMember },
    { value: DEFAULT_TEAM_ROLE_VALUE.ADMIN, label: labels.teamRoleAdmin, tone: 'accent' },
  ]
}

/**
 * O papel como a tela deve exibi-lo — e papel desconhecido NÃO some.
 *
 * Uma linha cujo `role` não está na lista continua aparecendo, com o valor cru como rótulo. O
 * contrário esconderia da tela justamente a pessoa cujo papel ninguém declarou, que é quem mais
 * precisa ser vista: some da listagem quem tem acesso que o host não sabe explicar.
 */
export function resolveTeamRole(
  roles: readonly TeamRoleOption[],
  value: string,
): TeamRoleOption {
  return roles.find((role) => role.value === value) ?? { value, label: value }
}

/**
 * A lista que o `<select>` de EDIÇÃO deve mostrar para uma pessoa já existente.
 *
 * Se o papel atual não estiver entre as opções, ele entra: sem isto o `<select>` abriria já
 * marcando outra coisa, e salvar o nome de alguém — sem tocar no campo de papel — rebaixaria a
 * pessoa em silêncio.
 */
export function withCurrentRole(
  roles: readonly TeamRoleOption[],
  current: string,
): readonly TeamRoleOption[] {
  return roles.some((role) => role.value === current) ? roles : [...roles, { value: current, label: current }]
}
