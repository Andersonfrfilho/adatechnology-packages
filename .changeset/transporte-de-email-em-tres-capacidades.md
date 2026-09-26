---
'@adatechnology/conversation-contracts': minor
'@adatechnology/conversation-module': minor
---

O transporte do canal `email` passa a ser **três capacidades separadas**, porque num produto real
elas não moram no mesmo processo: `ConversationEmailReplyAddressPort` (derivar e conferir o token do
endereço de resposta), `ConversationEmailSenderPort` (entregar) e `ConversationEmailInboundPort`
(baixar o MIME bruto e ler o veredito de DKIM).

No consumidor que motivou o pacote, a API deriva o endereço, o relay da fila entrega, e o worker do
webhook baixa e verifica — exigir as três de cada processo faria cada um implementar um `throw` no
que ele não tem, e um `throw` disfarçado de implementação é pior do que uma ausência declarada.

`ConversationEmailTransportPort` continua existindo como as três juntas, para quem faz tudo num
processo só. O que a subida exige (D5) é a capacidade do **endereço de resposta**: é ela que faz a
resposta voltar para a conversa certa, e é o que "canal que aceita mensagem e perde a resposta é
pior que canal desligado" protege.
