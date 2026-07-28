---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Biblioteca de arquivos com filtro, ordenação e paginação de verdade.

O painel ganha a UI do financiamento-imobiliario-bot: busca por nome, filtro de origem
(Todas / Cliente / Equipe), alternância de ordem (Mais recentes ↔ Mais antigos), limpar
filtros aparecendo só quando há filtro ativo, item com selo de origem + `data · tamanho` e
duas ações (visualizar e baixar), mais paginação com total.

O backend passou a **honrar** esses parâmetros, que antes existiam só no contrato:
`listByConversation` aceita `sources`, `sortDirection`, `page` e `limit`, e devolve
`{ rows, total }` — a contagem roda com o mesmo `where` mas sem o corte de página, senão o
total viraria o tamanho da página e a paginação nunca sairia da primeira.

Duas decisões de fronteira:

- `sources` é **lista explícita** (`['agent','bot']`), não apelido. Agrupamento tipo "Equipe"
  é vocabulário de tela e muda por produto; quem traduz é a rota HTTP do host, e o módulo
  segue sem conhecer rótulo de UI.
- `sources: []` é tratado como ausência de filtro, não como "nenhuma origem aceita" — um
  `inArray` com lista vazia gera `false` e devolveria zero linhas para quem só quis dizer
  "todas".

Toda mudança de filtro volta para a página 1: filtrar na página 3 pediria uma fatia que o novo
resultado talvez não tenha, e o painel apareceria vazio como se não houvesse arquivo.
