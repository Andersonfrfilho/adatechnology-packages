---
'@adatechnology/conversations-ui': patch
---

O editor de fluxos cabe em tela estreita, dispensa o cabeçalho e volta a pulsar.

Três correções no `FlowsWorkspace`, todas achadas ao montar a tela num produto novo:

- **A barra de ações quebra linha.** Os quatro botões somam ~588px e a linha não tinha
  `flex-wrap`: em 375px a barra empurrava a página inteira para o lado, e o host só conseguia
  esconder o estrago com `overflow-x-auto` por fora. Agora ela quebra e continua alinhada à
  direita.
- **`showHeader`.** Produto cuja navegação já nomeia a tela mostrava o nome duas vezes, em dois
  tamanhos — o `text-2xl` daqui contra a tipografia do host. `labels` não resolvia: o texto era
  o mesmo, o problema era existir. `showHeader={false}` deixa só a barra de ações, e o padrão
  segue `true`.
- **`getLivePositions` aceita a linha agregada.** `meta-whatsapp-module` responde
  `GROUP BY (flowKey, currentNodeId)` — `{ flowKey, nodeId, count }` — e o editor só sabia ler
  uma linha por sessão. O resultado era card que nunca pulsa em todo produto que usa o módulo,
  sem erro nenhum para denunciar. `countLiveByNode` agora normaliza os dois formatos, então
  quem já implementou o de sessão não muda nada; na raiz, a linha agregada dispensa a exceção
  do `menuNodeId`, porque a chave do fluxo já vem nela.
