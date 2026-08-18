---
'@adatechnology/catalog-contracts': minor
'@adatechnology/catalog-module': minor
'@adatechnology/meta-graph-core': minor
'@adatechnology/module-http': minor
'@adatechnology/meta-whatsapp-module': patch
---

Rota dedicada de webhook de catálogo

A Meta configura callback **por objeto**: o objeto `catalog` é assinado separado do WhatsApp
Business Account, com payload de formato diferente. Passa a ter rota própria
(`GET`/`POST /webhook/catalog`) em vez de dividir a de mensagens, onde um handler teria que
desempatar por `object` e um payload novo cairia no ramo errado em silêncio.

- `meta-graph-core` ganha os primitivos de webhook (`isValidWebhookSignature`,
  `isValidWebhookChallenge`, `buildWebhookDeliveryKey`), compartilhados entre os objetos que a Meta
  assina. `meta-whatsapp-module` passa a usá-los sem mudar assinatura pública nem chave de nonce.
- `module-http` ganha `TextResult`: o desafio de verificação exige o `hub.challenge` cru — em JSON
  ele sai entre aspas e a Meta reprova a URL.
- Fail-closed: sem `config.webhook`, a rota **não é publicada**. Sem segredo não há como distinguir
  a Meta de quem descobrir a URL.
