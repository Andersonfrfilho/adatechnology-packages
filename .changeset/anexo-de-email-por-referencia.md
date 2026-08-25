---
'@adatechnology/notification-contracts': minor
---

Anexo de e-mail no contrato, por referência e como variável declarada.

`SendEmailParams` ganha `attachments`, e `TemplateVariableDefinition` ganha `kind` (`text` |
`attachment`). O anexo trafega como URL `https` — nunca como conteúdo — porque template é linha
versionada no Postgres e job é payload no Redis: um PDF em qualquer um dos dois vira blob replicado
a cada versão e a cada tentativa, e nota fiscal é dado pessoal (`security.md` §6 e §7).

A distinção de `kind` existe porque as duas validações são opostas: variável de texto declarada e
ausente do corpo é aviso, e variável de anexo ausente do corpo é o normal — ele viaja ao lado da
mensagem. Sem o tipo, todo anexo obrigatório apareceria eternamente como "faltando no texto".
`diffTemplateVariables` ganha `attachmentsInText` para o caso inverso: `{{nota}}` escrito no corpo
renderiza a URL crua no meio da frase e não anexa nada.

Aditivo: catálogo sem `kind` continua valendo como `text`, e `attachments` é opcional.
