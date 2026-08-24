---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-module': minor
'@adatechnology/notification-client': minor
'@adatechnology/notification-ui': minor
---

Painel de templates: criar, remover, catálogo de variáveis e preview em dois viewports.

O editor só sabia editar o que já existia. Agora cria chave nova, remove (desativando a
identidade inteira, para a versão anterior não voltar ao ar) e mostra as variáveis que a
notificação declara como lista clicável — o operador nunca digita `{{campo}}` à mão, que era
o erro que renderizava vazio sem log e sem falha.

O preview passou a sair em dois quadros simultâneos, computador e celular, com os limites
reais do canal marcados. Comparar é a operação que revela a mensagem que cabe num viewport e
quebra no outro; um seletor mostraria um estado por vez.

Migração: nenhuma. `templateVariables` na config do módulo é opcional — sem ele, qualquer
`{{campo}}` continua sendo aceito, como antes.
