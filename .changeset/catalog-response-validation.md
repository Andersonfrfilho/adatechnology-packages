---
"@adatechnology/whatsapp-provider": patch
---

Valida em runtime (zod) as respostas da Graph API usadas por `WhatsAppCatalogProvider` (createProduct, getProduct, createProductSet, listCatalogs, createCatalog) em vez de apenas fazer type assertion (`as`) sobre elas. Uma resposta com formato inesperado agora lança `WhatsAppUnexpectedResponseError` com uma mensagem clara, em vez de propagar um erro de runtime confuso mais adiante no código.
