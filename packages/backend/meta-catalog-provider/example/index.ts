/**
 * Example de uso do @adatechnology/meta-catalog-provider — SDK stateless para gerenciar
 * catálogo de produtos (Meta Commerce). Independente de WhatsApp (ver .specs/features/
 * meta-catalog-trio/spec.md §1 — "Catálogo ≠ WhatsApp").
 *
 * Rodar: bun run packages/backend/meta-catalog-provider/example/index.ts
 * Requer META_ACCESS_TOKEN e META_WABA_ID no ambiente para as chamadas reais.
 */
import { MetaGraphError } from '../../meta-graph-core/src/index'
import { MetaCatalogProvider } from '../src/MetaCatalogProvider'

const accessToken = process.env['META_ACCESS_TOKEN']
const wabaId = process.env['META_WABA_ID']
const catalogId = process.env['META_CATALOG_ID']

if (!accessToken || !wabaId) {
  console.log('Defina META_ACCESS_TOKEN e META_WABA_ID para rodar o exemplo real.')
  process.exit(0)
}

async function main() {
  const catalog = new MetaCatalogProvider({ accessToken: accessToken!, wabaId, catalogId })

  console.log('Listando catálogos da conta...')
  const catalogs = await catalog.listCatalogs()
  for (const c of catalogs) console.log(`- ${c.name} (${c.id})`)

  if (!catalogId) {
    console.log('\nDefina META_CATALOG_ID para criar/consultar produtos de um catálogo específico.')
    return
  }

  console.log(`\nCriando produto de exemplo no catálogo ${catalogId}...`)
  const created = await catalog.createProduct({
    retailerId: `example-product-${Date.now()}`,
    name: 'Produto de exemplo',
    description: 'Criado pelo example do meta-catalog-provider',
    priceInCents: 1990,
    currency: 'BRL',
    imageUrl: 'https://example.com/product.jpg',
    categoryLabel: 'exemplo',
  })
  console.log('Criado:', created.id)

  const detail = await catalog.getProduct(created.id)
  console.log('Detalhe:', detail)

  await catalog.deleteProduct(created.id)
  console.log('Produto de exemplo removido.')
}

main().catch((error) => {
  if (error instanceof MetaGraphError) {
    console.error(`Erro da Graph API [${error.code}]:`, error.message)
    process.exitCode = 1
    return
  }
  throw error
})
