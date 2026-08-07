---
'@adatechnology/conversations-ui': minor
---

Upload de documento avulso na biblioteca (`DocumentsWorkspace`/`DocumentsLibrary`).

Nova capacidade opcional `ConversationsApi.uploadDocument(file, extra?)`. Ausente, a tela
continua só leitura como hoje; presente, um botão "Enviar documento" aparece na toolbar de
filtros e recarrega a lista após o envio. Cada host implementa o adapter pro seu próprio
contrato de upload (base64, multipart, presigned URL) — o pacote não assume formato de payload.

`extra` reaproveita o mesmo vocabulário livre que já viaja em `renderFilters`, pra associar o
arquivo enviado ao contexto (cliente, unidade) que a tela estava filtrando.
