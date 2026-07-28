---
'@adatechnology/conversations-ui': patch
---

Fixtures de documento no preview e correção do ícone de Word/Excel.

O preview ganha a conversa "Rita Documentos", que responde com **todo tipo que o composer
aceita** (`DEFAULT_ACCEPTED_FILE_TYPES`: `image/*`, `video/*`, `audio/*`, `.pdf`, `.doc`,
`.docx`, `.xls`, `.xlsx`, `.zip`) mais sticker — um por mensagem. `PREVIEW_DOCUMENTS` deriva
a biblioteca dessas mensagens em vez de repetir os dados, senão as duas fixtures divergiriam
na primeira edição e o painel mostraria arquivo que a thread não tem. O mock `getDocuments`
deixa de devolver `[]` e passa a filtrar por nome, como o backend faz com `ilike`.

**Correção que essas fixtures expuseram na primeira execução:** o
`ConversationDocumentsPanel` passava só `mimeType` ao `FileIcon`, e o mapa de ícones é
indexado por extensão curta. O mimeType do Office é longo
(`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), então `docx`,
`doc`, `xlsx` e `xls` apareciam todos com o ícone genérico cinza em vez do azul de Word e do
verde de Excel. Agora o `filename` vai junto e a extensão resolve primeiro.

`resolveFileIconExtension` foi extraída e exportada para teste — é a regra que regrediu, e
seis casos cobrem os quatro mimeTypes de Office, a resolução por mimeType puro e o fallback
genérico.
