---
'@adatechnology/conversation-contracts': minor
'@adatechnology/conversations-ui': minor
---

Protocolo legível da conversa na visão do participante: `protocol?` opcional em `ParticipantConversationSummary`
(gerado pelo produto, nunca pelo pacote); a lista mostra o protocolo na linha, o cabeçalho da conversa o mostra
com botão de copiar (aviso `aria-live`), e a lista ganha busca por título ou protocolo (parcial, sem traço, sem
caixa). Oito labels novas com defaults em inglês no bloco de protocolo e busca: `searchLabel`, `searchPlaceholder`,
`noResults`, `noResultsInFilter`, `noResultsLoadedOnly`, `protocolPrefix`, `copyProtocol`, `protocolCopied`. O default de
`copyProtocol` mudou de "Copy" para "Copy protocol". Ausente `protocol` = nada desenhado.

A lista mostra, em cada conversa, os canais que interagem nela e o ícone do assunto: `channels?` (até 5 canais do
vocabulário, sem repetição) e `iconName?` (nome opaco, `[a-z0-9-]`, até 32) em `ParticipantConversationSummary`,
ambos calculados pelo servidor. A UI ganha selos de canal na linha (spans, sem lista dentro do botão) e no cabeçalho (lista), a prop `renderSubjectIcon?`
(pura, não lança; sem ela ou devolvendo `null`, `undefined`, `false` ou `''`, vale o ícone do grupo) e seis labels novas: `channelsGroup`, `channelApp`, `channelWhatsapp`,
`channelEmail`, `channelPortal`, `channelWebchat`.

**Compatibilidade: esta versão restaura o padrão da 0.4.2.** A 0.5.0 havia mudado `MessageText` e `StatusTicks` para
todos os consumidores (classes `.cv-*` no lugar das utilitárias Tailwind, `role="button"`/`tabIndex`/`onKeyDown` no texto,
rótulo do selo "Copied" no lugar de "Copiado!" e marcação nova dos tiques). A 0.6.0 devolve o padrão: `MessageText` volta ao
`<div onClick>` com as classes Tailwind exatas, selo "Copiado!", e `StatusTicks` volta à marcação `cursor-help leading-none
flex items-center` com `text-black/40`/`text-sky-500`/`text-red-500` e `data-cv-tooltip`, sem `aria-label`; quem subiu para a
0.5.0 volta ao padrão antigo. O comportamento novo é opt-in: `MessageText accessibleCopy` (role, tabIndex e Enter/Espaço) e
`appearance="stylesheet"` em `MessageText`/`StatusTicks` (classes `.cv-*`; em `StatusTicks` também `queued` com relógio,
`bounced` como `failed`, `aria-label` e `queuedLabel`). A visão do participante já usa `appearance="stylesheet"`.

Ampliação de tipos a observar: `MessagePayload['status']` passa a aceitar `queued` e `bounced`, e `ConversationChannel`
ganha `app` e `portal`; `Record<ConversationChannel, …>` e `switch` exaustivos no host precisam cobrir os novos membros.
