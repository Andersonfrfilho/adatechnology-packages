---
'@adatechnology/notification-contracts': minor
'@adatechnology/notification-ui': minor
---

O preview passa a ter a moldura do canal, em vez de duas caixas brancas iguais.

Duas caixas rotuladas "600px" e "375px" nao respondem a pergunta de quem escreve a mensagem:
*como isso chega?* O enquadramento e o corte SAO a informacao — sem eles o preview so prova que o
texto existe.

- **e-mail**: janela de navegador com barra de endereco no desktop, e aparelho com o app de e-mail
  no celular — nos dois, remetente e assunto acima do corpo, com o assunto cortado em duas linhas
  como o cliente corta
- **WhatsApp**: balao recebido sobre o papel de parede da conversa, sem assunto, porque o canal nao
  tem
- **SMS**: balao cinza cru, sem assunto e sem formatacao
- **push**: cartao na tela bloqueada, com o corte de duas linhas que o sistema aplica
- **inbox**: o cartao da propria lista de notificacoes

Push, WhatsApp e SMS passam a ter SO o quadro de celular: sao canais de aparelho, e um quadro largo
ao lado sugeriria uma leitura em tela grande que nao existe — alem de o corte que importa so
acontecer no celular.

As cores das molduras sao do CANAL, nao da marca, e ficam em custom property com fallback
(`--adn-preview-wa-wallpaper` e companhia) para o host ajustar sem forkar. Os textos da moldura
("para voce", "agora") entram por locale, como todo o resto.

`senderName` e novo em `NotificationSettingsWorkspace`: e o remetente do e-mail e o app do push. Sem
ele o preview cai na inicial do assunto, nunca num literal inventado.
