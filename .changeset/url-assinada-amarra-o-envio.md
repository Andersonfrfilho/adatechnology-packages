---
'@adatechnology/conversation-contracts': minor
'@adatechnology/conversation-module': minor
---

A URL assinada de subida de anexo passa a **amarrar o que vai subir**: `contentType` e
`contentLength` daquele pedido entram na assinatura, e não só na linha do banco.

Antes, `createSignedUpload` recebia só bucket, chave e prazo. O tipo e o tamanho declarados eram
gravados na linha do pedido e conferidos **depois**, quando o anexo era ligado à mensagem — mas a
URL, enquanto valesse, aceitava qualquer arquivo de qualquer tamanho. A conferência posterior
recusa o anexo; o objeto já teria entrado no bucket.

`createSignedDownload` ganhou, pelo mesmo motivo de completude, `fileName` e `disposition`
(`attachment | inline`) — é o que decide se o navegador salva ou abre, e o provedor de storage
precisa dos dois para assinar.

Quebra de tipo para quem implementa `ObjectStoragePort`: os dois métodos agora recebem campos a
mais. Quem já implementava contra um provedor S3 tem esses valores à mão.
