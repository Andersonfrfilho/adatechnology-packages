---
'@adatechnology/notification-module': minor
---

O despacho passa o anexo ao driver de e-mail.

Fecha o terceiro passo da cadeia: o contrato declara (`kind: 'attachment'`), o driver anexa, e aqui
o despacho descobre **o que** anexar.

Quem decide é o **catálogo de variáveis do template**, não a forma do valor. Farejar a estrutura —
"tem `filename`, `url` e `contentType`, deve ser anexo" — transformaria qualquer objeto que o
produto mandasse no payload num anexo por acidente, e o acidente só apareceria na caixa de entrada
de quem recebeu. É por isso que o `kind` existe no contrato, e é por isso que ele é lido aqui.

Só a **referência** segue para o driver; os bytes não passam por este processo. Ele pode nem chegar
a enviar — supressão, canal desligado, preferência — e carregar 25MB para descobrir isso é
desperdício num processo que atende outras entregas junto.

Anexo declarado e **ausente do payload é silêncio, não erro**: o mesmo template serve o disparo que
leva a nota e o que não leva, e derrubar a entrega por um anexo opcional trocaria "e-mail sem PDF"
por "e-mail nenhum" — que é pior. O que o destinatário perde é o arquivo; o que ele não pode perder
é o aviso.

O log registra quantidade e tipos, nunca a URL (assinada, é credencial — `security.md` §1) nem o
nome do arquivo, que pode ser pessoal.

`templateVariables` entra em `DispatchDeliveryConfig` como **opcional**: ausente significa catálogo
não declarado, e aí nada é anexo. Tornar obrigatório quebraria todo host que compõe o use case à
mão.
