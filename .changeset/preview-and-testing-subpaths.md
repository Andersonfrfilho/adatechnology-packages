---
'@adatechnology/conversations-ui': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/meta-whatsapp-contracts': minor
---

Subcaminhos novos de importação: `conversations-ui/preview` e `/testing` no módulo e nos
contratos.

`conversations-ui/preview` traz `createMockConversationsApi`, `createMockSSEProvider`,
`createPreviewWebhookClient`, `ConversationPreview` e fixtures — é o que permite rodar a
inbox inteira localmente, com dados mockados, antes de existir backend ligado.

`meta-whatsapp-module/testing` e `meta-whatsapp-contracts/testing` expõem os utilitários
de teste que antes só existiam dentro do pacote, para o consumidor montar cenário sem
recriar dublê a cada projeto.

Os três `package.json` passam a declarar `exports` explicitamente, com `types`/`import`/
`require` por subcaminho — sem isso o subcaminho novo resolve no consumidor por acaso, ou
não resolve.
