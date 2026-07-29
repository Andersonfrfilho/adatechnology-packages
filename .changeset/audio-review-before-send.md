---
'@adatechnology/conversations-ui': minor
---

`AudioRecorderButton` ganha etapa de revisão: ao parar a gravação, o áudio aparece num painel com player, e só sai depois de confirmado — ou é descartado ali mesmo. Voz é o único anexo que quem envia não viu antes de mandar, e sem ouvir não há como saber se o microfone captou alguma coisa.

Gravação de zero byte agora falha com mensagem própria em vez de virar anexo vazio. O comportamento anterior de envio direto continua disponível via `reviewBeforeSend={false}`.
