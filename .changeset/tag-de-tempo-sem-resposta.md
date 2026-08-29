---
'@adatechnology/conversations-ui': patch
---

Selo de tempo sem resposta na linha da conversa, com faixas de 0–6h e 6–12h.

A inbox mostrava a janela de sessão do canal — quanto tempo ainda resta para enviar texto livre —,
que é regra de plataforma, não de serviço. Faltava a pergunta que o operador faz ao varrer a lista:
há quanto tempo este cliente espera resposta. As duas divergem exatamente no caso que importa:
respondida a conversa, o relógio do SLA para e o da janela continua correndo.

`replyLatencyOf` deriva a espera do que a listagem já traz — última mensagem do cliente sem resposta
nossa depois dela. Conversa já respondida e cliente que nunca escreveu não ganham selo: encher a
lista de selos em conversa que não deve nada é o mesmo que não ter alerta.

Verde até 6h, e a partir daí o selo perde a cor de "tudo certo" — acima de 12h vira crítico, para
uma espera de três dias não se parecer com uma de sete horas. `isReplyOverdue` é o corte exportado
para o host montar alerta e filtro sem repetir a regra.
