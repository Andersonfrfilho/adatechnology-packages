---
"@adatechnology/conversations-ui": patch
---

O gravador de áudio avisa que está gravando e corta sozinho num teto configurável.

O botão sempre foi um interruptor — o segundo toque é que envia — mas nada na tela dizia isso: o
operador gravava, não via nada acontecer e concluía que o microfone estava quebrado. Agora o botão
pulsa em vermelho enquanto grava, e `onRecordingChange` deixa o host avisar por fora (o simulador
troca o texto do campo para "Gravando… toque no quadrado para enviar").

`maxDurationMilliseconds` corta a gravação sozinho, com padrão de 5 minutos — folgado dentro do teto
de 16MB que a Meta impõe a áudio. Gravação esquecida aberta só se descobria no envio, com o arquivo
inteiro perdido.
