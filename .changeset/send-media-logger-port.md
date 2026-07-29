---
'@adatechnology/meta-whatsapp-module': minor
---

`createSendMediaAction` passa a receber uma porta de transcript (`FlowMediaTranscriptLogger`) em vez da classe `LogMessageUseCase`. Host em migração, com as mensagens ainda no schema próprio, consegue usar a action built-in sem gravar o envio numa tabela que o painel dele não lê. `LogMessageUseCase` continua satisfazendo a porta — nada muda para quem já monta o módulo inteiro.
