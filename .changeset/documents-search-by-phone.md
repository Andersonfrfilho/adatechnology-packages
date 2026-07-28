---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Busca da biblioteca de documentos acha por telefone da conversa, não só por nome do arquivo.

Quem procura um anexo raramente lembra como ele chegou nomeado — lembra de quem mandou. A busca
agora casa **nome do arquivo OU telefone da conversa**, com uma sutileza que decide se a coisa
funciona na prática: a tela mostra `+55 (11) 94444-3333` e o banco guarda `5511944443333`, então o
mesmo termo vira dois predicados — o nome mantém a pontuação (faz parte do arquivo), o telefone é
comparado só pelos dígitos. Colar o número como ele aparece na lista funciona.

Termo sem dígito nenhum não gera o predicado do telefone: `%%` casaria toda conversa e a busca por
nome deixaria de filtrar.

A contagem passou a usar o mesmo `innerJoin` da listagem. Sem isso a query nem compila quando a
busca cita `sessions.whatsapp_number` — e se compilasse, o total divergiria das linhas e a paginação
prometeria páginas vazias.

O filtro virou a função pura `companyDocumentSearch`, coberta por teste que renderiza o SQL (sem
Postgres no pipeline), e o mock do preview aplica a mesma regra para o `DocumentsLibrary` não
ensinar um comportamento que a tela real não entrega.
