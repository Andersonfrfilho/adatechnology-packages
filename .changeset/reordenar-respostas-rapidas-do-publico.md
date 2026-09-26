---
'@adatechnology/conversation-module': minor
---

Novo caso de uso `ReorderQuickRepliesUseCase` (`module.useCases.reorderQuickReplies`) — a quarta
falta que o primeiro consumidor achou no pacote. Reordena de uma vez o conjunto inteiro de
respostas rápidas de um público, para a tela de gestão com arrastar-e-soltar do consumidor: a
reordenação não é um `update` por linha, é a troca de posição do público inteiro.

A regra, portada do consumidor, é do agregado — não do host: `QuickReplyRepositoryPort` ganhou
`reorder`, que trava as linhas do público (`for update`, com as inativas — a desativada continua
no conjunto e mantém posição) antes de entregar o conjunto lido ao caso de uso, e grava as
posições novas (`0..n-1`) na mesma transação. O caso de uso confere que a lista recebida é
exatamente o mesmo conjunto já cadastrado ali — sem repetido, sem faltar, sem sobrar — e recusa
com o novo erro tipado `QuickReplyOrderInvalidError` (`CONVERSATION_QUICK_REPLY_ORDER_INVALID`,
422) sem gravar nada quando diverge. Duas reordenações concorrentes do mesmo público nunca
terminam numa mistura das duas — provado contra Postgres real com duas conexões.

Quebra de tipo para quem implementa `QuickReplyRepositoryPort` fora deste pacote: a porta ganhou
o método `reorder`, que precisa ser acrescentado à implementação.
