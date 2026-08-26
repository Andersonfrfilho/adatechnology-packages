---
'@adatechnology/user-ui': minor
---

Ordenacao por cabecalho, switch de ativacao e acao em lote visivel na tabela de equipe.

A tabela nascera sem ordenacao — a regra de listagens pede cabecalho clicavel, e a tabela de
mensagens ja o tinha; esta ficara para tras. Agora nome, e-mail, papel e situacao ciclam
`asc` -> `desc` -> ordem natural, com `aria-sort` no `th`. Situacao ordena por ativo, e nao
alfabeticamente sobre "true"/"false", que poria o inativo na frente.

A ativacao era um botao de texto na ponta da linha. Virou `role="switch"`, que e o que diz que o
clique grava na hora — distincao que importa numa linha onde ja existe um checkbox de selecao,
cujo sentido e o oposto: marcar para agir depois.

A barra de acao em lote ficava escondida ate haver selecao, para poupar espaco. O efeito foi que
ninguem descobria que a acao existia: era preciso adivinhar que marcar uma linha revelaria um
controle. Agora ela aparece com a lista, desligada, e diz o que fazer para liga-la.

O `select` de papel usava a seta do sistema operacional, que cada SO desenha do seu jeito e nenhum
acompanha o tema escuro. Passou a `appearance-none` com chevron proprio herdando `currentColor`, e
altura fixa para terminar na mesma linha que os campos vizinhos.
