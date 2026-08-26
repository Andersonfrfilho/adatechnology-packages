---
'@adatechnology/user-ui': minor
---

`TeamWorkspace` ganha busca, seleção por linha e ações em lote.

O `web.md` §7 exige, para toda tela com dado tabular: filtros, checkbox por linha com "selecionar
todos", barra de ação em lote e botão de limpar visível só quando há o que limpar. A tela entregou
tabela e paginação, e devia os outros quatro.

- **Busca** sobre nome e e-mail — quem procura lembra de um dos dois, raramente do id.
- **Checkbox por linha e no cabeçalho**, com `aria-label` que nomeia a linha: `Selecionar` repetido
  em dez linhas não diz ao leitor de tela qual delas.
- **Barra de ação em lote** que só existe com algo marcado. Controle permanente e desabilitado ocupa
  espaço em toda visita para servir a minoria delas.
- **Limpar busca** só aparece com busca aplicada.

Três decisões que não são óbvias:

- **A seleção morre quando o filtro muda.** Manter marcado o que saiu da tela é agir em lote sobre
  gente que o operador não está vendo.
- **O lote roda em série, não em paralelo.** São escritas no mesmo recurso; dez de uma vez multiplicam
  a chance de o rate limit derrubar metade e deixar o operador sem saber quais mudaram.
- **"Nada cadastrado" e "nada encontrado" são mensagens diferentes.** A primeira pede criar, a
  segunda pede afrouxar a busca.

A busca filtra no cliente porque `listTeam` devolve a equipe inteira; quando houver paginação real
do servidor, o termo passa a viajar com `page` e o filtro local sai.
