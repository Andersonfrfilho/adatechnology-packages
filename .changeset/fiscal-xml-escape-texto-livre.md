---
'@adatechnology/fiscal-provider': patch
---

CT-e e MDF-e: escape de texto livre no XML

`CteXmlBuilder` não escapava nada e `MdfeXmlBuilder` só escapava no builder de evento. Um `&`
em razão social, endereço, produto predominante ou observação produzia XML inválido — e a
assinatura ia junto, então a rejeição chegava como falha de schema sem apontar o campo.

`escapeXml` saiu de dentro do `MdfeEventoXmlBuilder` para `sefaz/SefazXmlEscape.ts` e agora
cobre todos os campos de texto livre dos dois builders.
