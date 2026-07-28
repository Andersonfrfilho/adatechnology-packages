---
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/meta-whatsapp-contracts': minor
---

Exclusão de conversa e retenção dos arquivos.

`ObjectStorageInterface` ganha `delete?(uploadId)` — opcional para não quebrar implementações
existentes, mas **sem ele não existe exclusão de verdade**: a cascata da FK derruba a linha e
deixa o binário órfão, cobrado indefinidamente e sem nada que o alcance.

`DeleteConversationUseCase` apaga a conversa e a mídia dela. A ordem é o ponto: **storage
primeiro, banco depois**. Apagar a sessão antes levaria embora a única lista de `uploadId` que
existe, porque ela vive nas linhas que a cascata remove. Se algum objeto falhar, a conversa é
**preservada** e o chamador recebe a lista — apagar as linhas "mesmo assim" transformaria uma
falha reexecutável em lixo pago e inalcançável. Com arquivos e sem `delete` no storage, recusa
em vez de apagar pela metade.

`PurgeExpiredDocumentsUseCase` aplica a mesma ordem por idade, com `retentionDays` vindo do
produto (o módulo não escolhe política de dado pessoal) e teto por execução. Objeto que falha
mantém a linha, para a próxima varredura tentar de novo.

`SessionRepository.deleteByNumber` é a raiz da cascata e existe para ser chamada pelo use case,
não direto pelo host — o comentário no método diz por quê.

Sete casos de teste cobrem as duas ordens, incluindo os que silenciariam o problema: falha de
objeto preservando a conversa, storage sem `delete`, e conversa sem anexo não exigindo storage.
