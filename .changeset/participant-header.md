---
'@adatechnology/conversations-ui': minor
---

Visão do participante (`/participant`): novos `avatars="initials"`, `renderAuthorAvatar` (slot do host para a foto), `tail` e o tipo exportado `ParticipantAuthorAvatarRenderer`.

Muda por padrão, sem o host fazer nada: o cabeçalho da conversa fica enxuto (assunto em cima, selos de canal na mesma linha do protocolo), o botão de copiar o protocolo passa a ser só um ícone e a bolha ganha rabinho de balão no canto inferior (esquerdo na recebida, direito na própria); `tail={false}` volta ao canto arredondado. É opt-in o avatar do autor (sem foto no SDK). Só a visão do participante é afetada (`src/participant/**` e `.cv-p-*`); nenhum outro export muda.
