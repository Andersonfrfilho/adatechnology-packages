---
'@adatechnology/fiscal-provider': patch
---

Completa os campos de cadastro do CT-e 4.00 que faltavam para paridade com o XML devolvido pela SEFAZ:

- `emit/xFant` — novo `nomeFantasia` opcional em `CteConfig`, emitido entre `xNome` e `enderEmit`.
- `cPais`/`xPais` no endereço de todo participante (`enderReme`, `enderExped`, `enderReceb`, `enderDest`),
  fechando o grupo depois de `UF`. `CteParticipante` ganhou `cPais`/`xPais` opcionais; sem valor
  declarado o participante é tratado como nacional (`1058`/`Brasil`), como no resto do provider.
- `compl/xEmi` — novo `funcionarioEmissor` opcional em `CteData`, emitido antes de `xObs`. O grupo
  `compl` passa a abrir com qualquer um dos dois presentes.

Todos os elementos são opcionais no leiaute: CT-e emitido sem eles continua sendo autorizado.
