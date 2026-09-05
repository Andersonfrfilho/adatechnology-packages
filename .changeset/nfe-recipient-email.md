---
'@adatechnology/fiscal-provider': minor
---

O e-mail do participante da NF-e deixa de ser descartado

A NF-e traz `<email>` dentro de `<dest>`, ao lado do `<fone>` que o importador já lia, e
`NfeXmlParty` não tinha o campo — então o valor era lido do XML e jogado fora antes de chegar a
qualquer consumidor. Medido em 2026-09-05 numa base real de transportadora: **2337 de 2372** NF-e
arquivadas trazem o campo preenchido, 98,5%.

`NfeXmlParty` ganha `email?: string`, e `parseParty` o lê. Campo opcional, aditivo: quem já consome
o tipo continua compilando, e nota sem `<email>` segue devolvendo `undefined` em vez de string
vazia.

⚠️ **Ele é irmão de `<enderDest>`, não filho.** No layout da NF-e o telefone mora no endereço e o
e-mail mora na parte, então o campo entrou em `NfeXmlParty` e **não** em `NfeXmlAddress` — quem for
persistir isso guarda no participante, não no endereço. Lê-lo do endereço por analogia com o
telefone devolveria `undefined` em toda nota, sem erro nenhum; é o modo de falha que o contrato
`nfe-import` tranca, junto do caso sem o campo e do transportador, que não o tem no layout.
