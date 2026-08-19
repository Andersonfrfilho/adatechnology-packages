---
"@adatechnology/conversations-ui": minor
---

`MessagesWorkspace` aceita papéis adicionais de template (ex.: despedida), além do principal.

Cada host que precisava de mais de um template configurável (boas-vindas e despedida, por exemplo)
remontava a tela à parte para empilhar um segundo `WhatsAppTemplateSettingsForm` — foi o caso do
financiamento imobiliário, que mantinha uma página `/templates` duplicada só por isso. Agora
`MessagesWorkspaceApi.templateRoles` aceita uma lista de papéis (`key`, `labels`, `getSettings`,
`saveSettings`), cada um ganhando seu próprio formulário empilhado na aba "Templates WhatsApp", com
carregamento e salvamento independentes do papel principal.

`MessagesWorkspace` também passa a repassar `createTemplatePreviewCompanyName` e
`createTemplateVariableExamples` para o formulário de criação, e `WhatsAppTemplatesSettings` ganha o
prop `extraRoleForms` que sustenta isso — ambos opcionais, sem mudança de comportamento para quem já
usa o componente com um único papel de template.
