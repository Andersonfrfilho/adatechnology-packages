---
'@adatechnology/meta-whatsapp-provider': minor
---

Envio de localização (`sendLocation`), que é o que o WhatsApp desenha como mapa na conversa.

O provider só sabia mandar texto, mídia, template e mensagens interativas. Quem precisava mostrar um
endereço no mapa mandava um link do Google Maps — e link não vira mapa: o preview do WhatsApp lê as
tags Open Graph da página de destino e monta, na melhor hipótese, um card com o logo do Google. O
quadradinho com o pino existe só na mensagem `type: location`.

`name` e `address` são opcionais porque a Meta os trata como rótulo do pino, não como endereço
validado. As coordenadas são conferidas antes do envio: a Graph API aceita latitude e longitude
trocadas de lugar e devolve um pino em outro continente, sem erro nenhum.
