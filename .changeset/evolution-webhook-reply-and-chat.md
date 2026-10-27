---
'@adatechnology/evolution-whatsapp-provider': minor
---

`parseEvolutionWebhook` passa a dizer de que chat veio a mensagem (`chat`: `user`, `group`, `broadcast`, `lid`), com o
número real do `@lid` quando o Evolution manda `remoteJidAlt`/`senderPn`, o id da mensagem citada
(`replyToExternalMessageId`) e a legenda de imagem, vídeo e documento como texto. `evolutionWebhookInstance` lê o nome da
instância que entregou o evento.
