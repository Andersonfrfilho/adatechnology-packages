---
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
---

O motivo da recusa da Meta para de ser descartado no webhook de status, e o `wamid` ganha uma
forma segura de ir para o log.

`whatsAppStatusSchema` não declarava `errors`, e `z.object` descarta o que não declara: o campo
era apagado na validação, antes de qualquer coisa. O efeito era pior do que "um dado a menos" —
`onStatusUpdate` **era** chamado em toda recusa, só que com o único dado que explica a recusa já
removido. Quem precisava do motivo não tinha como saber que o hook servia, e acabava reprocessando
o corpo cru do webhook por fora do módulo. Foi o que aconteceu no QuickCart: a conta estava barrada
de mandar mensagem para o Brasil (130497) e cada envio virava silêncio idêntico ao de um bug
próprio — o cliente não recebia nada, e nem o log nem a linha da mensagem sabiam dizer de quem era
a culpa. Custou uma investigação inteira, e duas hipóteses erradas, chegar ao código.

Com `errors` no schema, o motivo segue em duas direções, porque as perguntas são duas:
`meta_whatsapp.messages.payload` guarda a recusa na própria linha da mensagem (merge jsonb, para
não perder o que o envio já tinha gravado), e responde "este envio chegou?" muito depois de o log
ter expirado; `onStatusUpdate` entrega o status completo ao host, que é quem pode reagir agora —
alertar, pausar a fila, trocar de canal. Nenhum hook novo: o que faltava era o dado, não o gancho.

`hashWaMessageId` entra nos contracts porque o `wamid` parece opaco e não é. `wamid.HBgNNTUxNjk5...`
é base64, e o que está codificado ali dentro é o telefone do destinatário em claro — logar o id cru
publica o número do cliente numa linha onde ninguém procura por PII, já que o campo nem tem nome de
telefone. O hash preserva o que o log precisa (a mesma mensagem dá sempre a mesma chave, então os
vários status de um envio continuam se juntando) e descarta o que ele não pode ter. É propriedade
do formato da Meta, não de um app: mora junto do schema que descreve o formato.

`MessageRepository.updateMessageStatus` passa a receber objeto (`UpdateMessageStatusParams`) em vez
de três posicionais. É classe interna do módulo, não porta implementada pelo host.

Um detalhe achado ao testar a gravação contra Postgres de verdade, e que vale para muito além
desta mudança: sob `drizzle-orm/bun-sql`, **toda escrita em coluna jsonb vira escalar string no
banco**. O `mapToDriverValue` do jsonb do drizzle faz `JSON.stringify`, e o `bun-sql` liga string
a jsonb como valor string — `jsonb_typeof` devolve `string`, não `object`. A leitura desfaz com
`JSON.parse` e o app nunca percebe; o que quebra é tudo que trate a coluna como objeto no próprio
Postgres (`payload -> 'chave'`, índice GIN, filtro em consulta de painel). `updateMessageStatus`
normaliza a linha de volta a objeto na própria escrita, para o merge não produzir
`["{...}", {...}]` sobre dado que já estava torto. As outras colunas jsonb do schema continuam
sendo gravadas assim — é defeito pré-existente e de escopo maior (atinge outros módulos que usam
o mesmo driver), e fica para correção própria, com migration de normalização.
