---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-module': minor
'@adatechnology/notification-client': minor
'@adatechnology/notification-ui': minor
---

Roteamento por empresa: quais canais cada categoria pode usar.

Faltava a camada do meio. O chamador já podia enumerar `channels` em cada `sendNotification`, e
quem recebe já tinha preferência — mas "cobrança nunca sai por SMS" não cabia em nenhum dos dois:
o primeiro espalha a decisão por todo o código, o segundo entrega ela ao destinatário.

`notification.category_policies` é um TETO, não um piso: desligar barra o canal para todo mundo,
inclusive sobre `explicitChannels`; ligar apenas permite, e a preferência do usuário continua
valendo por cima. O canal barrado vira `delivery` com status `skipped` e razão
`disabled_by_policy` — some da entrega, nunca do histórico.

Migração: `20260824120000_category_policies` cria a tabela. É aditiva, e linha ausente significa
permitido — nenhuma notificação muda de comportamento até alguém desligar algo na tela.
