---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

O nome de perfil do contato chega ao host

A Meta entrega `contacts[].profile.name` ao lado das mensagens — o nome que a PESSOA escolheu no
WhatsApp dela —, e o módulo não expunha. O produto que cria o cliente a partir de uma mensagem
criava uma ficha sem nome, mesmo com a Meta tendo mandado o nome junto.

`onMessageReceived` ganha um terceiro parâmetro opcional, `contact`, com `profileName`. Host que já
implementa o hook com dois parâmetros continua funcionando.

O nome viaja no JOB, não é relido depois: quando o worker roda, o payload da Meta não existe mais.
Job antigo sem o campo continua válido, então subir o módulo não exige drenar a fila.

O casamento é por `wa_id`, com uma exceção deliberada: quando nenhum casa e há UM contato só, o
nome é dele — no Brasil o nono dígito faz `wa_id` e `from` divergirem, e exigir igualdade perderia o
nome justamente nos números móveis. Com dois ou mais contatos sem casamento, nenhum nome é usado:
pendurar o nome errado numa ficha é pior que ficha sem nome.
