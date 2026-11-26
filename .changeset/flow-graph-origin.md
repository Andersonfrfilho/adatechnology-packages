---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

Origem e versão de seed no grafo de fluxo, para o produto atualizar grafos semeados que o dono nunca editou sem apagar à mão. Contracts: `FLOW_GRAPH_ORIGIN` (`seed`/`edited`), `FlowGraphOrigin` e os campos opcionais `origin` e `seedVersion` em `FlowGraphData` e `FlowGraphSummary`. Módulo: colunas `origin` (default `edited`) e `seed_version` em `meta_whatsapp.flow_graphs` (migration aditiva nos dois layouts, v1 e journal); `CreateFlowGraphUseCase` aceita `seedVersion` (grafo nasce `seed`); `SaveFlowGraphUseCase` sempre grava `edited`, ignorando `origin` do payload; novo `ReseedFlowGraphUseCase` (`module.flows.reseed`) que troca o conteúdo só de grafo `seed` de outra versão, com a condição no próprio UPDATE (edição concorrente nunca é sobrescrita) e resultado `updated`/`current`/`edited`/`missing`. Grafo anterior ao campo conta como `edited`.
