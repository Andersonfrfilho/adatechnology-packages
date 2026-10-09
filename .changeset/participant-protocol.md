---
'@adatechnology/conversation-contracts': minor
'@adatechnology/conversations-ui': minor
---

Protocolo legível da conversa na visão do participante: `protocol?` opcional em `ParticipantConversationSummary`
(gerado pelo produto, nunca pelo pacote); a lista mostra o protocolo na linha, o cabeçalho da conversa o mostra
com botão de copiar (aviso `aria-live`), e a lista ganha busca por título ou protocolo (parcial, sem traço, sem
caixa). Seis labels novas com defaults em inglês: `searchLabel`, `searchPlaceholder`, `noResults`,
`protocolPrefix`, `copyProtocol`, `protocolCopied`. Ausente `protocol` = nada desenhado.

A lista mostra, em cada conversa, os canais que interagem nela e o ícone do assunto: `channels?` (até 5 canais do
vocabulário, sem repetição) e `iconName?` (nome opaco, `[a-z0-9-]`, até 32) em `ParticipantConversationSummary`,
ambos calculados pelo servidor. A UI ganha selos de canal na linha e no cabeçalho, a prop `renderSubjectIcon?` (sem ela
ou devolvendo vazio, vale o ícone do grupo) e seis labels novas: `channelsGroup`, `channelApp`, `channelWhatsapp`,
`channelEmail`, `channelPortal`, `channelWebchat`.
