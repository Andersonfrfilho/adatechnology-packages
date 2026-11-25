---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/conversations-ui': minor
---

`FlowNodeData.possibleNext`: destinos que o handler de uma action pode devolver em `next` (que já vencia o `next` do nó). O runtime não lê a lista; o editor desenha esses caminhos tracejados a partir de linhas próprias no card, conta-os na alcançabilidade e na validação de referência, limpa-os ao apagar o nó de destino e avisa quando a lista está num nó que não é action. Campo "Destinos que a ação pode escolher" no painel do nó de ação.
