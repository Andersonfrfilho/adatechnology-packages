---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/text-moderation': minor
---

Marcação de mensagem ofensiva no transcript.

O `LogMessageUseCase` aceita um `MessageModerator` opcional, injetado por
`providers.moderator`, e grava o veredito nas colunas novas `moderation_flagged` e
`moderation_terms` (migration `0005_message_moderation`), com índice parcial sobre as
sinalizadas.

`null` significa NÃO AVALIADO — moderação desligada ou mensagem anterior ao recurso —
e é deliberadamente diferente de `false`, que é avaliado e limpo. Só mensagem `inbound`
é inspecionada: etiquetar o que o bot ou o atendente enviou não sinaliza abuso.

O contrato do moderador é declarado no módulo em vez de importado de
`@adatechnology/text-moderation`, para o recurso continuar opcional e não amarrar
moderação a WhatsApp — o que atravessa a fronteira é texto.

`@adatechnology/text-moderation` entra como pacote novo: motor de inspeção com lista
curada, sem depender do dicionário pt de terceiros.
