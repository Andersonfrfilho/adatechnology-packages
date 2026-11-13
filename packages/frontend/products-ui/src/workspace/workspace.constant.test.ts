import { describe, expect, it } from 'bun:test'

import { isProductsWorkspaceArea, PRODUCTS_WORKSPACE_AREA } from './workspace.constant'

describe('isProductsWorkspaceArea', () => {
  it('aceita as áreas que a tela sabe abrir', () => {
    expect(Object.values(PRODUCTS_WORKSPACE_AREA).every(isProductsWorkspaceArea)).toBe(true)
  })

  // O host lê isto da query string, que é entrada de usuário: `?aba=lixo` não pode virar área.
  it('recusa valor que não é área', () => {
    expect(isProductsWorkspaceArea('lixo')).toBe(false)
  })
})
