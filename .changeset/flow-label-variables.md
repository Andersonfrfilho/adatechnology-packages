---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Rótulos de botão e lista com `{{variável}}`. Módulo: `listButtonLabel` (do nó ou do `flowRunner.listButtonLabel`) é interpolado com as variáveis do fluxo, como o título das opções (que já era interpolado no envio e no casamento do texto digitado); acima de 20 caracteres a escolha continua saindo numerada. conversations-ui: `validateGraph(graph, labels, { variableExamples })` mede botão (20), linha de lista (24) e botão da lista (20) sobre o texto interpolado com o exemplo da variável; sem exemplo conta só a parte fixa e emite aviso (não erro) quando a marcação escrita passa do limite. Novos rótulos opcionais em `validation` (`buttonTitleMayBeTooLong`, `listTitleMayBeTooLong`, `listButtonLabelTooLong`, `listButtonLabelMayBeTooLong`), `measureLabel` exportado e prop `variableExamples` em `FlowsWorkspace`.
