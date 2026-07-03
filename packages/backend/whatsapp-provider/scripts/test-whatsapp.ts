import { createWhatsAppProvider } from '../src/WhatsAppProviderFactory'
import { WhatsAppMessageProvider } from '../src/providers/WhatsAppMessageProvider'
import { WhatsAppTemplateProvider } from '../src/providers/WhatsAppTemplateProvider'
import { WhatsAppCatalogProvider } from '../src/providers/WhatsAppCatalogProvider'

// Smoke test offline: valida a superficie publica do pacote sem chamar a Graph API.
// Os flags --messages/--templates/--catalog/--all existem para uso manual futuro
// contra a API real da Meta; hoje todos rodam a mesma checagem offline.

const provider = createWhatsAppProvider({
  accessToken: 'test-token',
  phoneNumberId: 'test-phone-id',
  catalogId: 'test-catalog-id',
  wabaId: 'test-waba-id',
  businessId: 'test-business-id',
})

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Smoke test failed: ${message}`)
}

assert(provider.messages instanceof WhatsAppMessageProvider, 'messages provider not instantiated')
assert(provider.templates instanceof WhatsAppTemplateProvider, 'templates provider not instantiated')
assert(provider.catalog instanceof WhatsAppCatalogProvider, 'catalog provider not instantiated')

const catalogMethods = [
  'listCatalogs',
  'createCatalog',
  'updateCatalog',
  'deleteCatalog',
  'createProduct',
  'deleteProduct',
] as const
for (const method of catalogMethods) {
  assert(typeof provider.catalog[method] === 'function', `catalog.${method} is not a function`)
}

console.log('WhatsApp provider smoke test passed')
