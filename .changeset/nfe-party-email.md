---
'@adatechnology/fiscal-provider': minor
---

`NfeXmlParty` ganha `email?`, lido de `<dest><email>` da NF-e importada (`recipient.email`). Sem a tag, ou com a tag vazia, o campo fica `undefined`; o emitente não tem `<email>` no layout 4.00.
