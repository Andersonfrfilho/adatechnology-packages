---
'@adatechnology/object-storage-provider': minor
---

`createSignedDownload` passa a aceitar `disposition` (`inline` | `attachment`) e `filename`, assinando
`response-content-disposition` na URL. Sem eles o navegador decide pelo content-type e abre XML/PDF na
aba em vez de baixar; como o cabeçalho entra na assinatura, a escolha precisa ser feita na emissão da
URL — o cliente não consegue acrescentá-la depois.
