---
"@adatechnology/conversations-ui": minor
---

Histórico da conversa: a página anterior é buscada a cerca de uma tela do topo (prefetch), balões-esqueleto aparecem no topo enquanto ela carrega, e a posição de leitura é mantida pela mensagem-âncora mesmo se o operador continuar rolando durante a busca. `overflow-anchor: none` no transcript evita o salto duplo no Firefox.
