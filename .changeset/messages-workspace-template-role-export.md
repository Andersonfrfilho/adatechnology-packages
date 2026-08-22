---
"@adatechnology/conversations-ui": patch
---

`MessagesWorkspaceTemplateRole` passa a ser exportado pelo pacote.

O tipo já existia e era usado pela prop `MessagesWorkspaceApi.templateRoles`, mas faltava na lista de
re-exports do `index.ts` — quem tentasse tipar o próprio array de papéis (`satisfies
MessagesWorkspaceTemplateRole[]`) esbarrava em "has no exported member". Sem mudança de
comportamento, só completa a superfície pública já documentada no changeset anterior.
