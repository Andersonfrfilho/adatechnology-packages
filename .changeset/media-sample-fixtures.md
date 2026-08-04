---
'@adatechnology/meta-whatsapp-module': minor
---

Amostras binárias de mídia em `@adatechnology/meta-whatsapp-module/testing`.

`MEDIA_SAMPLES` descreve 14 formatos — um de cada espécie que a Meta aceita (image, video,
audio, document, sticker) — e `readMediaSample(name)` devolve os bytes. Junto vai o
reexport de `buildInboundMediaPayload`, que já existia nos contratos mas não estava
alcançável por quem depende só do módulo.

Existe porque QuickCart e Order Hub carregavam os mesmos arquivos, byte a byte, cada um na
sua pasta de seeds. Duplicação de dado que não é decisão de produto: o conjunto de tipos
aceitos é definido pela Meta, e a cópia divergiria na primeira vez que a Meta aceitasse um
formato novo.

**São arquivos válidos, não placeholders.** O PDF abre com uma página, o XLSX abre com uma
planilha vazia, o OGG toca silêncio. Um `.txt` rotulado `application/pdf` atravessa upload,
ingestão e listagem sem reclamar, e só falha na frente do usuário — que é o único lugar
onde não dá para corrigir. O teste confere a assinatura de cada formato justamente para que
trocar o conteúdo por texto qualquer quebre no CI, e não na tela.

Vêm embutidas em base64 (~9 KB somados) em vez de asset no tarball: caminho de arquivo
dentro de `node_modules` muda com bundler, com ESM/CJS e com o layout do pnpm, e resolver
isso custaria mais que embutir.

O que **não** entra aqui é o seeder: quantos arquivos, em qual contato, sob qual empresa e
em que estado da sessão é decisão de produto, e fica na app que consome — como manda a
regra de nenhuma regra de negócio dentro do módulo.
