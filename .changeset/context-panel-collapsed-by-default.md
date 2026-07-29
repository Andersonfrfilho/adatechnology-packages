---
'@adatechnology/conversations-ui': minor
---

Painel de contexto nasce fechado, em qualquer tamanho de tela.

Antes ele abria sozinho no desktop sempre que houvesse ao menos um campo preenchido. Com 1 de 6
preenchidos — o caso comum no começo de uma conversa — isso significa ~200px mostrando quase só
travessões, empurrando para baixo a thread, que é o que se veio ver. O contador no cabeçalho (`1/6`)
já entrega a informação de relance e o rótulo `abrir` diz como ver o detalhe.

O padrão passa a viver no pacote em vez de em cada host: com cada produto decidindo, a mesma tela
nasce diferente em cada projeto, e a decisão certa aqui é a mesma para todos. Quem quiser o
comportamento antigo passa `defaultOpen`.
