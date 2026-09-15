---
'@adatechnology/fiscal-provider': patch
---

O texto da Carta de Correção (CC-e) deixa de ser descartado na importação de eventos

`importarNfeXml` já reconhecia o evento CC-e (`tpEvento` 110110), mas `NfeXmlEvent` não trazia o
texto da correção — `detEvento/xCorrecao` era lido do XML e descartado antes de chegar a qualquer
consumidor.

`NfeXmlEvent` ganha `correctionText?: string`, lido de `detEvento/xCorrecao` e aparado (`trim`).
Campo opcional, aditivo, e exclusivo do evento 110110: em qualquer outro tipo de evento —
cancelamento, por exemplo — `correctionText` permanece `undefined`, assim como quando o próprio
`xCorrecao` está ausente ou vazio. Nenhum outro campo do evento (`statusCode`, `protocol`,
`situacao`) muda de comportamento.
