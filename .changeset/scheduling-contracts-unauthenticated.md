---
'@adatechnology/scheduling-contracts': minor
'@adatechnology/scheduling-module': patch
---

Publica `UnauthenticatedError`, que o módulo já importava

`requireCompany` importa `UnauthenticatedError` do contracts, mas a classe entrou depois da
`0.1.0-rc.1` e o contracts nunca foi republicado. O `scheduling-module@0.1.0-rc.3` saiu pinado
naquela versão, então importar o módulo quebrava logo no carregamento:

```
SyntaxError: Export named 'UnauthenticatedError' not found in module
'@adatechnology/scheduling-contracts/dist/index.js'
```

Quem consome o módulo por HTTP não subia — no api-ada o `deploy:pre` falhava antes de aplicar
qualquer migration. Uma versão nova do contracts com a classe exportada, e o módulo passa a
depender dela.
