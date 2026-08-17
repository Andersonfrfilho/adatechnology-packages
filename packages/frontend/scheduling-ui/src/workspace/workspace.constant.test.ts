import { describe, expect, it } from 'bun:test'

import { isSchedulingWorkspaceArea, SCHEDULING_WORKSPACE_AREA } from './workspace.constant'

describe('isSchedulingWorkspaceArea', () => {
  it('aceita as áreas que a tela sabe abrir', () => {
    expect(Object.values(SCHEDULING_WORKSPACE_AREA).every(isSchedulingWorkspaceArea)).toBe(true)
  })

  // O host lê isto da query string, que é entrada de usuário: `?aba=lixo` não pode virar área.
  it('recusa valor que não é área', () => {
    expect(isSchedulingWorkspaceArea('lixo')).toBe(false)
  })
})
