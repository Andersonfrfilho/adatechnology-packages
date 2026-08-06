---
"@adatechnology/conversations-ui": patch
---

Enviar template de reengajamento assume o atendimento antes de mandar a mensagem.

Reabrir a janela de 24h é ato de atendente: quem manda o template quer conversar. Como a tomada não
acontecia, a resposta do cliente chegava com a conversa ainda no bot e o fluxo automático respondia
por cima de quem tinha acabado de reabri-la.

`onTakeover` agora aceita `void | Promise<void>` — o envio espera a tomada quando o host devolve
promessa. Host que devolve `void` continua compilando.

No mesmo lote, `totalCount` deixa de contar o tamanho da página quando a listagem é paginada no
servidor: mostrava "50 conversas" numa base de 306. Não lidas e aguardando seguem sendo da página,
porque somar a base inteira exige um agregado que a listagem não devolve.
