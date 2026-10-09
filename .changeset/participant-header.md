---
'@adatechnology/conversations-ui': minor
---

Visão do participante (`/participant`): novos `avatars="initials"`, `renderAuthorAvatar` (slot do host para a foto), `tail` e o tipo exportado `ParticipantAuthorAvatarRenderer`.

Muda por padrão, sem o host fazer nada: o cabeçalho da conversa fica enxuto (assunto em cima, selos de canal na mesma linha do protocolo), o botão de copiar o protocolo passa a ser só um ícone e a bolha ganha rabinho de balão no canto inferior (esquerdo na recebida, direito na própria); `tail={false}` volta ao canto arredondado. É opt-in o avatar do autor (sem foto no SDK). Só a visão do participante é afetada (`src/participant/**` e `.cv-p-*`); nenhum outro export muda.

Na mesma linha, a conversa passa a seguir o desenho de chat do WhatsApp com o estilo do app: voltar só com ícone (sem caixa), avatar da conversa com o ícone do assunto (nova prop opcional `renderSubjectIcon` em `ParticipantThread`/`ParticipantThreadHeader`, repassada por `ParticipantConversations`), título em uma linha com o protocolo embaixo, fundo da lista de mensagens com padrão sutil (token opcional `--cv-p-wallpaper`, `none` desliga), separador de dia em pílula com `<time>`, hora e ticks juntos ao pé da bolha, e compositor com ícones de anexar e enviar e campo que cresce até cerca de 4 linhas. O rótulo do grupo acima do título só aparece quando não há avatar. Só a visão do participante é afetada.
