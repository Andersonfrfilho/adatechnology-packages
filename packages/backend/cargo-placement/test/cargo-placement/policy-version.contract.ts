/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { CARGO_LAYOUT_POLICY_VERSION } from '../../src/cargo-layout-policy-version.constant.js'
import * as packageSurface from '../../src/index.js'

/**
 * A versão da política é a parte do `input_hash` que invalida toda planta guardada quando o desenho
 * muda para a mesma entrada. Ela precisa ser um texto curto, sem espaço, e sair pela raiz do pacote.
 */
describe('cargo layout policy version (spec 145 D6)', () => {
  test('is a short opaque token exported from the package root', () => {
    expect(typeof CARGO_LAYOUT_POLICY_VERSION).toBe('string')
    expect(CARGO_LAYOUT_POLICY_VERSION).toMatch(/^[0-9A-Za-z.-]{1,32}$/)
    expect(packageSurface.CARGO_LAYOUT_POLICY_VERSION).toBe(CARGO_LAYOUT_POLICY_VERSION)
  })
})
