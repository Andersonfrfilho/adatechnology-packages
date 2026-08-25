---
'@adatechnology/notification-ui': minor
---

Slot de ação no cabeçalho do editor: `renderEditorActions`.

Recebe a chave do template aberto e desenha ao lado de Fechar. É onde entra "Enviar teste" — provar
que a mensagem chega é operação do produto, não do pacote: ele não sabe para quem mandar, por qual
rota, nem o que fazer com o resultado. Sabe qual template está aberto, e é só isso que o slot
entrega.

A ação vem **antes** do Fechar: é o que a pessoa procura ali; Fechar é saída.

O mesmo slot serve o botão de anexo quando ele existir.
