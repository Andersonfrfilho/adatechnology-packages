---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

Webhook passa a tratar eventos de conta e deixa de descartar em silêncio o que não conhece.

`message_template_status_update` e `phone_number_quality_update` chegam na mesma rota das
mensagens, mas são eventos de nível WABA: não trazem `messaging_product` nem `metadata`. O schema
exigia `messaging_product` e o parse era `parse`, então cada evento desses lançava `ZodError` e
derrubava a entrega inteira — inclusive a mensagem de cliente que viesse no mesmo payload.

O que mudou:

- `changes[].field` passa a ser capturado. Sem ele não havia como rotear evento, e é ele que a
  Meta usa para dizer qual assinatura disparou.
- `messaging_product` virou opcional e `value` virou permissivo (`passthrough`). Validar o
  envelope como união fechada faz a Meta quebrar o webhook toda vez que adiciona campo numa versão
  nova; a validação estrita agora acontece por evento, contra o schema do próprio `field`.
- `parse` virou `safeParse`. Envelope irreconhecível vira `onUnhandledWebhookEvent` e resposta
  normal, em vez de exceção — a Meta desativa webhook que responde erro com frequência.
- Hooks novos: `onTemplateStatusUpdate`, `onPhoneNumberQualityUpdate` e
  `onUnhandledWebhookEvent`.
- `ReceiveWebhookResult` ganhou `accountEventsProcessed` e `unhandledEvents`.

`onUnhandledWebhookEvent` é o ponto principal: um field sem handler era indistinguível de webhook
que parou de chegar. Foi assim que os eventos de template ficaram invisíveis até alguém procurar.

`message_template_id` chega da Meta ora como número, ora como string; é normalizado para string na
fronteira em vez de espalhar `String()` pelos consumidores.
