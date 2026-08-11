---
"@adatechnology/meta-whatsapp-contracts": patch
"@adatechnology/meta-whatsapp-module": patch
---

`ChannelAdapterInterface` ganha `sendInteractiveButtons`, e o `WhatsAppChannelAdapter` o implementa.

O provider já sabia montar `interactive.type: "button"` desde sempre, mas a porta do canal só
expunha lista — então todo produto sobre o módulo caía em "Ver opções" mesmo com duas escolhas, que
é onde o botão de resposta rápida ganha da lista: a opção fica visível sem um toque a mais.

O método é **opcional na porta**. Exigi-lo quebraria todo dublê de teste e todo canal já escrito por
uma capacidade que nem todo canal tem; quem não implementa continua na lista, exatamente como antes.

Sai junto `WHATSAPP_CHOICE_LIMIT` com os tetos da Meta (3 botões de até 20 caracteres, 10 linhas de
até 24). Quem escreve o texto da opção precisa deles antes de publicar: passar do limite não degrada
a mensagem, a Graph API recusa ela inteira e o cliente vê silêncio.
