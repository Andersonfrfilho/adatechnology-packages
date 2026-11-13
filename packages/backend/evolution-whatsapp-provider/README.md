# @adatechnology/evolution-whatsapp-provider

Cliente da Evolution API (WhatsApp, auto-hospedada) com o mesmo contrato de canal do provider da Meta:
envio de texto e mídia, estado da conexão e leitura de webhook.

O Evolution fala o protocolo do WhatsApp Web, que a Meta não autoriza: o número pode ser banido. Use como
opção gratuita, com e-mail como reserva, e nunca para envio em massa.

## Grupos

- Enviar: passe o id do grupo (`120363025246125486@g.us`) como destino de `sendText`/`sendMedia`; ele segue intacto (qualquer outro destino é normalizado para dígitos).
- Receber: a mensagem de grupo traz `chat: 'group'`, `groupJid`, `participant` (número de quem escreveu, vazio se só houver `@lid`) e `mentionedJids`. `evolutionMentionsNumber(event, ownerNumber)` diz se o bot foi marcado (marcação por `@lid` não casa por número).
