/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { BrazilianDocumentInput } from './BrazilianDocumentInput'

const render = (value: string) =>
  renderToStaticMarkup(<BrazilianDocumentInput value={value} onValueChange={() => undefined} className="field" />)

describe('BrazilianDocumentInput', () => {
  it('shows the CPF mask for a stored value without punctuation', () => {
    expect(render('52998224725')).toContain('value="529.982.247-25"')
  })

  it('switches to the CNPJ mask, alphanumeric included', () => {
    expect(render('11222333000181')).toContain('value="11.222.333/0001-81"')
    expect(render('12abc34501de35')).toContain('value="12.ABC.345/01DE-35"')
  })

  it('marks a complete document whose check digits do not close', () => {
    expect(render('52998224726')).toContain('aria-invalid="true"')
    expect(render('11222333000182')).toContain('aria-invalid="true"')
  })

  it('does not flag a valid or still-incomplete document', () => {
    expect(render('52998224725')).not.toContain('aria-invalid')
    expect(render('5299')).not.toContain('aria-invalid')
  })

  it('keeps host attributes', () => {
    expect(render('')).toContain('class="field"')
  })
})
