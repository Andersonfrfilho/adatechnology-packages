---
"@adatechnology/conversations-ui": patch
---

`MessageComposer` ganha `idleAction`, que ocupa o lugar do botão de enviar enquanto não há nada para
enviar — é onde o WhatsApp põe o microfone.

O simulador pendurava o gravador de áudio fora do campo, num wrapper flex à direita do pill: o botão
virava um bloco branco solto, desalinhado com a barra. Agora ele entra pelo `idleAction` e o
composer volta a mandar no próprio layout.

O `AudioRecorderButton` passa a usar a mesma caixa do botão de enviar (40px) e ícone SVG no lugar do
emoji, para a barra não pular de altura quando a primeira letra é digitada.
