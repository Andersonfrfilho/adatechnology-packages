---
'@adatechnology/notification-ui': minor
---

Busca, filtros e agrupamento na lista de mensagens.

Com uma notificacao a lista era um cartao; com trinta vira um paredao onde ninguem acha nada.

- **Busca sobre chave E texto.** Quem procura costuma lembrar do que a mensagem diz, nao da chave
  tecnica que alguem escolheu meses atras — buscar so por chave deixaria de fora o caso comum.
- **Filtro por categoria e por canal**, ambos de selecao multipla (`web.md` §7), e o "limpar
  filtros" so aparece quando ha o que limpar.
- **Grupos pela categoria da chave.** O prefixo (`auth` em `auth.password_reset`) ja e a categoria
  que o produto escreveu: o modulo nao precisa de campo novo no banco, e um campo novo divergiria
  da chave na primeira vez que alguem renomeasse um sem o outro.
- **"Nada cadastrado" e "nada encontrado" sao estados diferentes**: o primeiro pede criar, o
  segundo pede afrouxar o filtro. Mostrar a mesma frase nos dois manda a pessoa para o lado errado.

`categoryLabelOf` e novo em `NotificationSettingsWorkspace`, para o produto dar nome humano a
categoria (`auth` -> "Acesso"). Ausente, mostra a propria chave.
