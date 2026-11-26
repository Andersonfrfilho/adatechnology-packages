---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-provider': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Botão de link e localização nos fluxos: `FLOW_ACTION_KIND.SEND_CTA_URL` (`interactive` `cta_url`, botão com até 20 caracteres, só http/https) e `SEND_LOCATION` (localização nativa), registradas pelo módulo; `ChannelAdapterInterface.sendCtaUrl?`/`sendLocation?` e `WhatsAppMessageProvider.sendInteractiveCtaUrl`. No simulador (`conversations-ui`): links http(s) soltos clicáveis (`rel="noopener noreferrer"`), botão `cta_url` e cartão de localização.
