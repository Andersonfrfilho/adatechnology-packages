---
'@adatechnology/fiscal-provider': patch
---

`NfeXmlProduct` traz o GTIN do item, antes descartado na importação

`importarNfeXml` lia `det/prod/cEAN` e `det/prod/cEANTrib` do XML mas descartava os dois campos
antes de chegar a qualquer consumidor de `NfeXmlProduct`.

`NfeXmlProduct` ganha `gtin?: string` (de `cEAN`) e `taxableUnitGtin?: string` (de `cEANTrib`),
aparados (`trim`). O literal `"SEM GTIN"` (em qualquer caixa/espaçamento) e o valor ausente ou
vazio viram `undefined`. Só valor com 8, 12, 13 ou 14 dígitos numéricos é aceito — qualquer outro
formato (letras, tamanho fora desse conjunto) também vira `undefined`. O dígito verificador do
GTIN não é validado aqui, fica a cargo da aplicação consumidora. Nenhum outro campo de
`NfeXmlProduct` muda de comportamento.
