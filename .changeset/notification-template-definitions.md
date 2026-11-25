---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-module': minor
'@adatechnology/notification-client': minor
---

Templates declarados pelo host: `config.templateDefinitions` (rótulo, descrição, variáveis com descrição, texto padrão) com `ensureTemplateDefinitions` (semente idempotente por chave), `listTemplateEditorItems` (`GET /notification-template-definitions`), `restoreTemplateDefault` (a rota `restore-default` passa a valer para toda chave declarada) e `renderTemplateText`. Contracts ganha `TemplateDefinition`, `assertTemplateDefinitions` e `description` em `TemplateVariableDefinition`; o client ganha `listTemplateDefinitions()`. Sem migration e sem mudança na sintaxe `{{campo}}`.
