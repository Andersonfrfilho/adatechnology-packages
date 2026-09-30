---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/meta-graph-core': minor
---

Recusa determinística da Meta para de derrubar o webhook

Sem fila configurada, os efeitos do webhook — inclusive a resposta do bot — rodam dentro da
requisição que a Meta faz. Quando a Graph API recusava esse envio, a exceção subia até a rota, o
host respondia não-2xx, e a Meta reentregava o evento.

Para uma falha de rede isso é exatamente o desenho certo: a reentrega resolve. Para uma recusa
determinística não é. Token sem `whatsapp_business_messaging`, conta barrada de mandar mensagem
para o país, payload inválido: a reentrega recebe a mesma recusa, para sempre. E webhook que falha
com frequência a Meta desativa — o canal inteiro cai, por uma causa que retentativa nenhuma ia
corrigir. Foi assim que um token com escopo errado virou risco de derrubar a inscrição.

Agora as duas coisas são separadas. `isDeterministicMetaRejection` (novo, em `meta-graph-core`)
distingue o que vale retentar do que não vale: `WHATSAPP_NETWORK_ERROR` e `WHATSAPP_TIMEOUT`
continuam subindo, porque ali a requisição nem chegou a ser julgada; qualquer outra recusa da Graph
API para de propagar e vira o hook novo `onInboundEffectRejected`.

A mensagem do cliente já está gravada quando isso acontece — ela é persistida antes dos efeitos.
O que se perde é a reação a ela, e o host é avisado na hora para alertar, pausar a fila ou trocar
de canal. Sem implementar o hook, a recusa continua registrada no `payload` da mensagem e o webhook
responde 200 em vez de arrastar a inscrição para o desligamento.

`META_GRAPH_ERROR_CODES` também passa a ser exportado: os códigos estavam como literal espalhado
pelos construtores de erro.
