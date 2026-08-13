---
'@adatechnology/catalog-image-storage-provider': minor
---

Ponte entre a porta de imagem do `catalog-module` e um bucket S3-compatível.

O módulo guarda `ProductImageStoragePort` e não a implementação de propósito: quem só gerencia
catálogo interno não deve baixar o SDK da AWS por tabela. Por isso a ponte é um pacote próprio, e
não uma dependência nova do módulo.

O que ela decide, para os produtos não redecidirem cada um do seu jeito:

- **URL pública e estável**, não assinada. Quem busca a imagem é a Meta, para renderizar o item
  dentro do WhatsApp — URL assinada expira e o catálogo aparece quebrado semanas depois, sem nada
  ter falhado no momento em que quebrou. Por isso a base pública é separada do endpoint do bucket.
- **`create-only`**: a chave já é um UUID novo a cada envio, então colisão é bug, e sobrescrever a
  esconderia.
- **`sha256` por `crypto.subtle`**, e não `node:crypto`, para o pacote rodar em Bun, Node e Workers
  sem import de runtime.
