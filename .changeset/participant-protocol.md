---
'@adatechnology/conversation-contracts': minor
'@adatechnology/conversations-ui': minor
---

Protocolo legível da conversa na visão do participante: `protocol?` opcional em `ParticipantConversationSummary`
(gerado pelo produto, nunca pelo pacote); a lista mostra o protocolo na linha, o cabeçalho da conversa o mostra
com botão de copiar (aviso `aria-live`), e a lista ganha busca por título ou protocolo (parcial, sem traço, sem
caixa). Seis labels novas com defaults em inglês: `searchLabel`, `searchPlaceholder`, `noResults`,
`protocolPrefix`, `copyProtocol`, `protocolCopied`. Ausente `protocol` = nada desenhado.
