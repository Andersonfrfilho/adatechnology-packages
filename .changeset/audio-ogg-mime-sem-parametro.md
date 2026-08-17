---
'@adatechnology/meta-whatsapp-provider': patch
---

Declara o áudio transcodificado como `audio/ogg`, sem o parâmetro `; codecs=opus`, e remove
parâmetros de qualquer mimeType no upload de mídia. A Meta compara o valor por igualdade literal:
com o parâmetro ela classifica o arquivo como `application/octet-stream` e recusa o envio com
131053, já no webhook de status.
