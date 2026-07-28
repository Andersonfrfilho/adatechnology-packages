---
'@adatechnology/conversations-ui': minor
---

Customização de estilo por props e etiqueta de moderação.

Os componentes da inbox passam a aceitar `className` na raiz e um mapa `classNames` por
slot: `ConversationHeader` (root, identity, name, meta, actions, desktopActions,
mobileMenu), `ConversationDocumentsPanel` (root, body, title, search, status, list, item,
filename, meta, downloadButton), `ConversationContextPanel`, `ConversationRow`,
`DateDivider`, `MessageComposer`, além de `className` em `MessageBubble`, `MediaRenderer`,
`FileIcon`, `Wallpaper` e `WindowExpiredNotice`. Antes só o `Wallpaper` aceitava, e produto
nenhum conseguia apertar espaçamento sem forkar o componente.

A biblioteca de arquivos ficou no mesmo nível de customização da conversa — era o pedido
explícito, e o painel é onde mais se mexe: cada produto lista documento de um jeito.

A fusão usa `tailwind-merge` (via `clsx`), não concatenação: quem decide entre `px-4` da
base e `px-2` do host é a ordem no CSS gerado, e o Tailwind emite `px-2` antes de `px-4`,
então concatenar deixaria a base ganhar — justo o caso de quem quer reduzir espaçamento.

`MessagePayload` ganha `moderation?: { isOffensive, terms } | null` e a bolha mostra uma
etiqueta âmbar quando o backend sinalizou. A UI só exibe, nunca calcula: dicionário no
browser seria peso morto e daria veredito diferente por versão de cliente. `null` ou
ausente é NÃO AVALIADO, distinto de avaliado e limpo. Sinaliza sem censurar nem esconder —
cliente xingando é cliente irritado, e o atendente precisa ler o que foi dito.

Correção no `MessageComposer`: a barra passa a ser a superfície cinza de largura cheia e o
campo interno é que arredonda, na ordem do WhatsApp. Invertido, o pill arredondado ia até
a borda da tela e os cantos descobriam o fundo branco da página.
