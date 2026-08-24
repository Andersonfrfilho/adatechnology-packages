---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-ui': minor
---

Preview por aparelho, canal com escolha multipla, e os campos alinhados.

**Aparelho no lugar de "desktop/mobile".** iOS e Android nao sao o mesmo preview com outra largura:
o cartao de push tem raio, tipografia e numero de linhas diferentes, os baloes tem cantos
diferentes, e a largura padrao difere (375 contra 360) — entao a linha quebra num antes do outro.
`PREVIEW_VIEWPORT` passa a ser `browser` / `ios` / `android`. E-mail mostra os tres; WhatsApp, SMS e
push mostram os dois aparelhos; inbox so o navegador.

**Canal virou escolha multipla.** Um aviso costuma sair por mais de um canal, e escolher um de cada
vez obrigava a reescrever o mesmo texto. No banco a identidade continua sendo
`key`+`channel`+`locale` — marcar varios grava um template por canal com o mesmo texto, em serie.
Depois cada canal e editado sozinho pela lista, porque o texto tende a divergir (o SMS encurta, o
WhatsApp perde o titulo). Os quadros do preview sao agrupados por canal: com dois canais marcados
nao dava para saber qual iPhone era qual.

**Campos alinhados.** `label`, `fieldset` e o bloco de identidade eram estilizados em lugares
diferentes e cada campo vinha com a sua altura. Uma regra so para todos, e os tres campos de
identidade passam a comecar na mesma linha.
