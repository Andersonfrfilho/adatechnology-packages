---
'@adatechnology/meta-catalog-provider': minor
---

`MetaCatalogProvider` ganha `getCommerceSettings`/`updateCommerceSettings` para o ícone do catálogo.

`whatsapp_commerce_settings` fica no número de telefone, não no catálogo — é o que decide se o ícone
do catálogo aparece no cabeçalho da conversa (`is_catalog_visible`) e se o botão "Adicionar ao
carrinho" fica disponível (`is_cart_enabled`), independente do catálogo já estar vinculado e
sincronizado. Até agora essa troca só existia manualmente pelo Gerenciador do WhatsApp da Meta.

`MetaCatalogProviderConfig` ganha `phoneNumberId` opcional, necessário só por esses dois métodos.
