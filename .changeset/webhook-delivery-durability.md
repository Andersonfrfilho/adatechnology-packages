---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/meta-graph-core': minor
---

Webhook de entrada deixa de perder mensagem quando o processo cai no meio da conversa.

Eram três causas somadas, e a correção mexe nas três:

- **Nonce gravado antes de processar.** A entrega era marcada com a janela cheia (300s) antes de
  qualquer efeito rodar; se o processo morria depois disso, a reentrega da Meta — único socorro que
  existe — batia numa porta fechada e a mensagem sumia em silêncio. Agora o `claimWebhookDelivery`
  reivindica por `WEBHOOK_CLAIM_TTL_SECONDS` (60s) e só o novo `confirmWebhookDelivery`, chamado ao
  fim do processamento, estende para `WEBHOOK_NONCE_TTL_SECONDS`. `NonceStoreInterface` ganha
  `confirm?()` — opcional, para não quebrar host existente, mas implementar é o caminho correto.
- **Efeitos de host dentro da requisição do webhook.** Chamadas de rede (motor de fluxo, IA,
  integrações) morriam junto com o processo em deploy. `ReceiveWebhookUseCase` aceita
  `inboundQueue`, uma porta (`InboundDispatchQueueInterface`) que o host implementa com a fila que
  já tiver. Sem ela, o comportamento é o de antes: os efeitos rodam inline.
- **Efeito duplicado em reentrega.** `buildInboundJobId` deriva um `jobId` estável da mensagem, e a
  fila descarta o segundo enfileiramento em vez de rodar a regra duas vezes.

O worker do host roda `ProcessInboundDispatchUseCase` sobre o mesmo `InboundEffectsDispatcher` que
o caminho inline usa — um só corpo de regra para os dois caminhos.

A fila precisa ser durável e ter retentativa com backoff. Fila em memória reintroduz exatamente a
perda que este desenho existe para evitar.
