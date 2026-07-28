---
'@adatechnology/meta-whatsapp-module': minor
---

Camada de dados da biblioteca de arquivos da conversa.

Tabela `meta_whatsapp.documents` (migration `0006_conversation_documents`), com
`DocumentRepository` e `ListConversationDocumentsUseCase` devolvendo o shape que o
`ConversationDocumentsPanel` do conversations-ui consome.

Tabela própria, e não derivada de `messages.payload`: o painel precisa de `source` e
`linkedAt`, que não existem no payload; busca por nome quer índice, não varredura de jsonb;
e `messageId` anulável é o que permite o atendente anexar arquivo à conversa sem mensagem
correspondente.

Semântica de vínculo, verificada contra Postgres: apagar a **mensagem** mantém o arquivo na
biblioteca e apenas zera `messageId` (`on delete set null`); apagar a **conversa** leva a
linha do documento junto (`on delete cascade`).

Atenção para quem for implementar exclusão: a cascata apaga a LINHA, não o binário no
storage. `listUploadIdsBySession` existe para isso — o passo de aplicação é listar os
`uploadId`, apagar os objetos e só então apagar a sessão. Confiar só na FK deixa objeto
órfão sendo cobrado indefinidamente.

`link()` é idempotente por `(companyId, uploadId)` via índice único, não por SELECT prévio:
o job de ingestão é reentregue por retry e duas tentativas concorrentes duplicariam a linha
no painel.
