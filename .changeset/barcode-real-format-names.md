---
'@adatechnology/product-vision-provider': patch
---

Corrige os nomes de formato do leitor de codigo de barras, que nao casavam com nada.

A lista aceita dizia `EAN-13`, `UPC-A`, `CODE-128`. O zbar devolve `ZBAR_EAN13`, `ZBAR_UPCA`,
`ZBAR_CODE128`. Nenhum simbolo passava pelo filtro, entao a leitura voltava sempre vazia — sem
erro, sem log, so o cliente recebendo "nao identifiquei" para toda foto de embalagem.

Os testes com duble nao pegaram porque eles repetiam a invencao: o duble devolvia `typeName:
'EAN-13'` e o filtro concordava. Entra um teste de integracao contra o zbar de verdade, com um
EAN-13 gerado no proprio teste, e uma asserção direta de que o `typeName` da biblioteca esta na
lista aceita.

O carregamento da peer tambem ganha uma segunda tentativa: o `import` dinamico resolve a partir
DESTE pacote, e gerenciador que instala por link (pnpm, bun) deixa a peer no consumidor — o engine
falhava como "pacote nao instalado" com o zbar corretamente instalado.
