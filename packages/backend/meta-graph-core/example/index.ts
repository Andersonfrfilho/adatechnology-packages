/**
 * Example de uso do @adatechnology/meta-graph-core — fundação genérica de acesso à Graph API
 * da Meta, usada por qualquer produto (whatsapp-provider, catalog-provider, ou um SDK próprio).
 *
 * Rodar: bun run packages/backend/meta-graph-core/example/index.ts
 * Requer META_ACCESS_TOKEN e META_CATALOG_ID no ambiente para o exemplo real fazer uma
 * chamada de verdade — sem eles, o script só demonstra a montagem da URL e a validação local.
 */
import {
  buildGraphUrl,
  graphFetch,
  assertConfigField,
  catalogListResponseSchema,
  parseGraphResponse,
  MetaGraphError,
} from '../src/index'

async function main() {
  // 1. Montagem de URL — versão da API + baseUrl configuráveis (útil para apontar a um mock
  //    local em dev/teste via WHATSAPP_GRAPH_BASE_URL, sem a app consumidora ler process.env).
  const url = buildGraphUrl('v21.0', 'me/businesses')
  console.log('URL montada:', url)

  // 2. assertConfigField — validação de configuração obrigatória, com erro tipado se ausente.
  try {
    assertConfigField(process.env['META_ACCESS_TOKEN'], 'META_ACCESS_TOKEN')
  } catch (error) {
    if (error instanceof MetaGraphError) {
      console.log('Config ausente (esperado sem token real):', error.message)
    }
  }

  const accessToken = process.env['META_ACCESS_TOKEN']
  const catalogId = process.env['META_CATALOG_ID']
  if (!accessToken || !catalogId) {
    console.log('\nDefina META_ACCESS_TOKEN e META_CATALOG_ID para rodar a chamada real de exemplo.')
    return
  }

  // 3. Chamada real + parse com schema zod — parseGraphResponse valida o shape e lança
  //    WhatsAppUnexpectedResponseError se a Graph API devolver algo fora do esperado.
  const productsUrl = buildGraphUrl('v21.0', `${catalogId}/products`)
  const raw = await graphFetch({ url: productsUrl, accessToken })
  const parsed = parseGraphResponse(catalogListResponseSchema, raw)
  console.log(`\n${parsed.data.length} produto(s) no catálogo:`)
  for (const product of parsed.data) console.log(`- ${product.name} (${product.id})`)
}

main().catch((error) => {
  if (error instanceof MetaGraphError) {
    console.error('Erro da Graph API:', error.message)
    process.exitCode = 1
    return
  }
  throw error
})
