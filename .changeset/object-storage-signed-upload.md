---
'@adatechnology/object-storage-provider': minor
---

`createSignedUpload`: URL assinada de PUT, para o cliente subir o arquivo direto ao storage sem
passar pela API.

`contentLength` entra na assinatura (o S3 recusa um upload de tamanho diferente do assinado);
`contentType` é só validado contra vazio e injeção de cabeçalho, porque o
`@aws-sdk/s3-request-presigner` marca `content-type` como cabeçalho não assinável em toda URL
presigned do S3 — quem consome o método precisa saber que isso não é amarrado. O sha256 também não
entra na assinatura, já que não há bytes para calcular aqui; a integridade se confere depois do
upload com `head()`.

Expiração com teto próprio de 900s (15 min), maior que os 300s do `createSignedDownload`: upload de
arquivo grande em rede ruim precisa de mais tempo que abrir um link de download.
