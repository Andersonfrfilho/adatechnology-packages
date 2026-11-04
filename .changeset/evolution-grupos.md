---
"@adatechnology/evolution-whatsapp-provider": minor
---

Grupos do WhatsApp: `sendText`/`sendMedia` aceitam destino `...@g.us` sem normalizar para dígitos (novos `isEvolutionGroupJid` e `resolveEvolutionDestination`); o parser do webhook devolve `groupJid`, `participant` e `mentionedJids` nas mensagens, e `evolutionMentionsNumber` diz se o número do bot foi marcado.
