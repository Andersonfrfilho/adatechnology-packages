---
'@adatechnology/conversations-ui': minor
'@adatechnology/meta-whatsapp-contracts': minor
---

Telas compostas de documentos, fluxos e mensagens no pacote

Os três produtos remontavam essas telas à mão — abas, estado, busca, salvamento — e foi assim que
divergiram. Agora o pacote exporta a tela inteira, e o host injeta só rotas e vocabulário:

- `DocumentsWorkspace`: biblioteca de documentos com filtros na URL.
- `FlowsWorkspace`: editor de fluxos completo (fusão editável, paleta, painel de nó, validação,
  contagem viva), com nó solto sinalizado e apelido de nó (`FlowNodeData.label`, novo no contrato).
- `MessagesWorkspace`: mensagens do bot, tópicos, templates do WhatsApp e transcrição.

Tudo além do mínimo é opcional por capacidade: sem o método na API injetada, a tela não desenha a
ação. Customização por contrato (`labels`, slots de render, `className`), nunca por fork.
