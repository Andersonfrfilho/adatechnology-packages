---
'@adatechnology/user-ui': patch
---

A tabela de equipe carrega com linhas fantasma, e nao com a palavra "Carregando".

O texto centralizado ficava FORA da tabela, abaixo dela: o corpo colapsava para altura zero enquanto
a resposta nao chegava, e a tabela crescia de volta ao chegar, empurrando a paginacao pela tela. O
salto e o que a pessoa ve; o aviso de carregamento ela mal le.

Agora o `tbody` recebe cinco linhas de esqueleto com a largura aproximada de cada coluna — foto
redonda, nome, e-mail, papel, situacao e acoes — enquanto `team.loading` estiver de pe. A altura da
tabela e a mesma antes e depois.

A primeira linha carrega `aria-busy` e o rotulo de carregamento; as demais vao com `aria-hidden`,
para o leitor de tela anunciar o estado uma vez em vez de cinco linhas vazias.
