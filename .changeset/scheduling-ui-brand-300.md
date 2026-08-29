---
'@adatechnology/scheduling-ui': patch
---

Destaque do tema escuro volta a existir: `brand-300` não é um tom da paleta

A paleta `brand` do ecossistema vai de `200` direto para `400` — não há `300`. Quatro lugares usavam
`dark:text-brand-300`, então no tema escuro a classe não produzia regra alguma e o elemento ficava
com a cor herdada: a aba ativa do agendamento, o botão ativo de Dia/Semana, o link "limpar filtros"
da tabela de reservas e o cabeçalho da coluna de hoje na agenda.

Um deles era regressão: a aba ativa usava `dark:text-brand-400`, que existe, e passou a `300`.

Descoberto verificando a tela em staging — a classe estava no HTML sem regra correspondente no CSS,
que é como esta família de erro sempre se apresenta: sem aviso, sem erro, só sem efeito.
