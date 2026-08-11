---
'@adatechnology/web-chat-widget': patch
---

Aviso de mensagem nova, tema do host e mascote animado no balão.

O widget passa a mostrar contador de não lidas no launcher, tocar um bip curto e disparar
notificação do navegador quando o bot responde com o painel fechado ou a aba escondida. Nada do
conteúdo da conversa entra na notificação — o corpo é texto fixo, porque o título aparece na tela
de bloqueio do sistema.

O site que tem alternador próprio agora manda no tema do chat: `theme="dark"` e `theme="light"`
no elemento vencem o `prefers-color-scheme`. Sem o atributo, o sistema continua decidindo.

O mascote deixou de aparecer só no launcher e no cabeçalho: ele anima também ao lado da primeira
fala de cada bloco, e ficou alinhado ao topo do balão — no rodapé ele parecia pertencer à mensagem
seguinte.

Microfone e enviar saíram de emoji para SVG: `web.md` §9 proíbe emoji em UI de produto, e o 🎤
ignorava a cor do botão em todos os estados.
