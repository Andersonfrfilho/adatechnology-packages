---
'@adatechnology/conversations-ui': minor
'@adatechnology/user-ui': minor
'@adatechnology/content-ui': minor
---

Slot opt-in `renderExport(context)` nas listagens `DocumentsWorkspace`, `TeamWorkspace` e `ContentWorkspace`/`PostList`. O host recebe `{ total, page, pageSize, pageCount, filters }` (o que a lista mostra agora) e monta o botão "Exportar" ao lado dos filtros; o pacote não gera arquivo, o backend do host usa os mesmos filtros. Sem a prop, nada muda.
