---
'@adatechnology/conversations-ui': patch
---

`renderMediaPicker` do `FlowsWorkspace` recebe o grafo junto do nó

Com fluxos fundidos o nó em edição pode pertencer a um fluxo que não é o raiz, e o seletor do host
precisa da chave dele para saber onde gravar. O painel já passava os dois; só a porta do workspace
tinha ficado com a assinatura antiga.
