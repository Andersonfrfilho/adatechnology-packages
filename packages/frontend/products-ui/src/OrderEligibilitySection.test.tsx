import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ProductForm } from './ProductForm'
import { OrderEligibilitySection } from './OrderEligibilitySection'
import { DEFAULT_ORDER_ELIGIBILITY_LABELS } from './lib/orderEligibility'
import { PRODUCT_OPTIONAL_FIELD, type ProductsApi } from './providers/types'
import { ProductsProvider } from './providers/ProductsProvider'

const noop = () => undefined
const api = {} as ProductsApi

function renderForm(fields: readonly string[], config: object = {}) {
  return renderToStaticMarkup(
    <ProductsProvider api={api} config={{ fields: fields as never, ...config }}>
      <ProductForm onSubmit={async () => undefined} catalogs={[]} sections={[]} />
    </ProductsProvider>,
  )
}

describe('OrderEligibilitySection', () => {
  it('mostra campo, chip 18 e as duas opções de público, sem select nativo', () => {
    const markup = renderToStaticMarkup(
      <OrderEligibilitySection
        value={{ minimumAge: '', audience: 'everyone' }}
        labels={DEFAULT_ORDER_ELIGIBILITY_LABELS}
        onChange={noop}
      />,
    )

    expect(markup).toContain('Quem pode pedir')
    expect(markup).toContain('Idade mínima para pedir')
    expect(markup).toContain('>18</button>')
    expect(markup).toContain('Todos')
    expect(markup).toContain('Só hóspedes com estadia ativa')
    expect(markup).toContain('role="radiogroup"')
    expect(markup).not.toContain('<select')
    expect(markup).not.toContain('type="number"')
  })

  it('marca o chip e o público selecionados', () => {
    const markup = renderToStaticMarkup(
      <OrderEligibilitySection
        value={{ minimumAge: '18', audience: 'staying_guests' }}
        labels={DEFAULT_ORDER_ELIGIBILITY_LABELS}
        onChange={noop}
      />,
    )

    expect(markup).toContain('value="18"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toMatch(/aria-checked="true"[^>]*>Só hóspedes/)
  })

  it('exibe o erro de idade', () => {
    const markup = renderToStaticMarkup(
      <OrderEligibilitySection
        value={{ minimumAge: '30', audience: 'everyone' }}
        labels={DEFAULT_ORDER_ELIGIBILITY_LABELS}
        error="Idade inválida"
        onChange={noop}
      />,
    )

    expect(markup).toContain('Idade inválida')
    expect(markup).toContain('aria-invalid="true"')
  })
})

describe('ProductForm com ORDER_ELIGIBILITY', () => {
  it('só desenha a seção quando o campo está ligado', () => {
    expect(renderForm([])).not.toContain('order-eligibility-section')
    expect(renderForm([PRODUCT_OPTIONAL_FIELD.ORDER_ELIGIBILITY])).toContain('order-eligibility-section')
  })

  it('rótulos sobrescrevem o padrão pela config', () => {
    const markup = renderForm([PRODUCT_OPTIONAL_FIELD.ORDER_ELIGIBILITY], {
      orderEligibilityLabels: { section: 'Restrições de pedido', everyone: 'Qualquer pessoa' },
    })

    expect(markup).toContain('Restrições de pedido')
    expect(markup).toContain('Qualquer pessoa')
    expect(markup).toContain('Idade mínima para pedir')
  })

  it('não mostra a chave reservada no editor de atributos', () => {
    const markup = renderToStaticMarkup(
      <ProductsProvider
        api={api}
        config={{ fields: [PRODUCT_OPTIONAL_FIELD.ATTRIBUTES, PRODUCT_OPTIONAL_FIELD.ORDER_ELIGIBILITY] }}
      >
        <ProductForm
          onSubmit={async () => undefined}
          catalogs={[]}
          sections={[]}
          initialValues={{ attributes: { capacidade: '4', orderEligibility: { minimumAge: 18 } } }}
        />
      </ProductsProvider>,
    )

    expect(markup).toContain('capacidade')
    expect(markup).not.toContain('{&quot;minimumAge&quot;')
    expect(markup).toContain('value="18"')
  })
})
