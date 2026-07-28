---
'@adatechnology/fiscal-provider': minor
---

CT-e: `cancel` passa a devolver o `procEventoCTe` em `FiscalResult.xmlEvento`

`SefazCteProvider.cancel` montava e assinava o `eventoCTe` do cancelamento (tpEvento 110111), mandava
para a SEFAZ e **descartava o XML**. O chamador recebia só `{ success, protocolo, rawResponse }` — e
`rawResponse` é o objeto já parseado, não o documento assinado. Quem precisa guardar o cancelamento
por 5 anos, como manda a legislação, não tinha o que guardar.

`FiscalResult` ganha o campo opcional `xmlEvento`. No `cStat` 135 (evento registrado e vinculado ao
CT-e), `sendCteCancelamento` devolve o par completo previsto no leiaute `procEventoCTe_v3.00`:

```xml
<procEventoCTe versao="3.00" xmlns="http://www.portalfiscal.inf.br/cte">
  <eventoCTe versao="3.00">…assinado…</eventoCTe>
  <retEventoCTe versao="3.00">…retorno da SEFAZ…</retEventoCTe>
</procEventoCTe>
```

O `eventoCTe` é exatamente o fragmento assinado que foi transmitido — não é remontado — e o
`retEventoCTe` sai por recorte do envelope SOAP cru, mesma técnica já usada em `xmlProtocolo` para o
`protCTe` da autorização. Em rejeição (`cStat` ≠ 135) `xmlEvento` fica `undefined`: não existe evento
registrado para arquivar.

Nada mais muda: `MISSING_PROTOCOLO`, `INVALID_JUSTIFICATIVA` (mínimo de 15 caracteres) e o formato do
`nProt`/`xJust` transmitidos seguem iguais, cobertos por teste de contrato com `fetch` mockado.
