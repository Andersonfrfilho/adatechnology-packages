---
"@adatechnology/whatsapp-provider": patch
---

Adiciona `baseUrl` opcional em `WhatsAppProviderConfig` para sobrescrever `https://graph.facebook.com` — permite apontar chamadas da Graph API para um mock local (ex.: WireMock) em desenvolvimento/teste, sem alterar o comportamento em produção quando não informado.
