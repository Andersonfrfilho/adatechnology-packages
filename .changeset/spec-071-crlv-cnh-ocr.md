---
'@adatechnology/document-intake': minor
---

O CRLV e a CNH entram na biblioteca, devolvendo o que o documento diz

`readCrlv` lê placa, RENAVAM, marca/modelo, ano-modelo, cor, combustível, carroceria, eixos,
município/UF e o nome e documento do proprietário — os campos **impressos**, canonicalizados, não a
ficha de nenhuma app: `bodyType: 'FURGAO'`, nunca `'02'`. A tradução para catálogo é de quem tem
catálogo, e as duas apps que leem CRLV têm catálogos diferentes.

`extractCnhFields` extrai nome, registro e categoria de texto de OCR, ancorado em rótulo e nunca em
formato — o CPF também tem onze dígitos e vem impresso antes do registro na CNH-e.
`createTesseractOcrClient` e `readsWithOcr` levam junto o cliente do `tesseract-server` e a regra que
escolhe entre camada de texto e OCR pelo tipo do arquivo.

Motivo: os três eram código de uma app que uma segunda passou a precisar, e nenhuma app importa
código-fonte de outra.
