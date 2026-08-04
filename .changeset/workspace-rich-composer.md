---
'@adatechnology/conversations-ui': minor
---

`ConversationsWorkspace` ganha o composer rico, a fila de anexos com legenda e a nota de voz.

Eram as últimas peças que impediam o terceiro produto de largar a cópia da tela. `composer="rich"`
troca o `textarea` pelo campo que desenha a formatação do WhatsApp enquanto se escreve;
`composerVariablesFor` oferece os marcadores que valem naquela conversa; `onSendAttachments`
enfileira os arquivos escolhidos e manda o texto escrito como legenda do último — mandar a legenda
em cada anexo fazia o cliente receber a mesma frase uma vez por arquivo; `onRecordAudio` desenha o
microfone no lugar do enviar enquanto não há o que enviar.

`renderAboveTranscript` passa a receber o contexto do fluxo junto da conversa: é dele que sai a
ficha de seleções, e sem isso o host teria de buscá-lo de novo só para desenhá-la.

Todos são opcionais e a ausência não desenha afordância: sem `onRecordAudio` não há microfone, sem
`onSendAttachments` o clipe volta a mandar cada arquivo na hora.
