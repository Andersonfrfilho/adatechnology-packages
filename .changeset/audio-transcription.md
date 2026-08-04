---
'@adatechnology/audio-transcription-provider': minor
'@adatechnology/meta-whatsapp-contracts': minor
'@adatechnology/meta-whatsapp-module': minor
'@adatechnology/conversations-ui': minor
---

Transcrição de nota de voz, com botão de copiar no balão.

`@adatechnology/audio-transcription-provider` entra como pacote novo: engine hospedado
(Groq/`whisper-large-v3-turbo`) por padrão, engine local (`whisper.cpp`) como export
opt-in em `/whisper-local`, e `createTranscriberChain` para encadear os dois. O engine
padrão não tem dependências — usa `fetch`, `FormData` e `Blob` globais — e aceita
OGG/Opus direto, que é o formato que a Meta entrega. Trocar de engine depois não toca
módulo nem UI.

Os erros carregam `isRetriable`, e é essa distinção que o resto do sistema consome:
estourar cota é espera, codec desconhecido é definitivo. Sem ela, quem consome só sabe
"não transcreveu" e escolhe entre desistir de um áudio que funcionaria em dez minutos ou
reprocessar para sempre um formato impossível.

O módulo grava o resultado em colunas novas de `messages` — `transcription_status`,
`transcription_text`, `transcription_language`, `transcription_engine` (migration
`0008_message_transcription`) — com índice parcial sobre os pendentes, que é o que
alimenta a varredura de retomada. `null` em `transcription_status` significa NÃO
AVALIADO, deliberadamente diferente de `'done'` com texto vazio, que é áudio em silêncio
já processado e que não deve voltar para a fila.

Quando transcrever é decidido em duas camadas: **ambiente decide se é POSSÍVEL, settings
decide se é para FAZER.** Chave de API não vai para tabela de tenant, então a capacidade
(engine, credencial, storage que sabe reler) continua injetada pelo host; já "transcrever
ou não" e "automático ou sob demanda" viraram configuração por empresa, em colunas novas
de `settings` (migration `0009_settings_transcription_policy`) — pedir deploy para mudar
isso transformaria um interruptor em ticket.

As colunas são tri-state de propósito: `null` significa "o painel não decidiu", e aí vale
o `providers.transcription.mode`/`isEnabledByDefault` do host. Se fosse `boolean` com
padrão `false`, atualizar o módulo desligaria a transcrição de quem já a tinha ligada por
variável de ambiente — regressão silenciosa num recurso que estava funcionando. O
`createTranscriptionPolicyResolver` combina os dois a cada áudio, e modo desconhecido
gravado na coluna `varchar` cai no padrão do host em vez de virar um estado que ninguém
trata.

No modo `'auto'` a transcrição roda dentro da ingestão da mídia, onde o buffer do áudio já
está em memória e não custa um segundo download do storage; em `'onDemand'` (padrão) só
quando o atendente pede, pelo `TranscribeAudioUseCase`. Falha de transcrição no modo
automático **nunca** derruba a ingestão: o binário já está salvo, e deixar o erro subir
faria o retry do host baixar de novo da Meta um arquivo que está no storage.

`TranscriptionDisabledError` (409) guarda a rota sob demanda quando a empresa está
desligada — mas transcrição JÁ SALVA continua sendo devolvida mesmo assim: a política
governa gastar cota, não ler o passado. Desligar o recurso não apaga nem esconde o que foi
transcrito enquanto estava ligado.

Falha retriável grava `'pending'` e dispara o hook novo `onTranscriptionDeferred`, que
carrega o `uploadId` para o host enfileirar uma transcrição — não uma segunda ingestão.
Sem implementar o hook, o áudio fica pendente e só sai sob demanda: não se perde nem
mente. Erros novos `AudioNotIngestedError` (409) e `MessageNotAudioError` (422) separam
"espere, estamos copiando o áudio" de "isso não é áudio", que é o que a interface precisa
para orientar o operador.

No `conversations-ui`, o balão de áudio ganha bloco de transcrição com botão de copiar.
Copiar é o motivo de o bloco existir: o operador cola o pedido do cliente no sistema
interno, e seleção manual dentro de um balão de chat é exatamente onde o arrasto do mouse
pega o balão vizinho e o horário. O bloco fica fora do ramo de carregamento da mídia —
ler o que o cliente disse sem baixar e tocar o áudio é o caminho rápido do atendimento.
`ConversationsApi.transcribeAudio` é opcional por capacidade: sem ele o botão não é
desenhado, em vez de estourar no clique.

`TranscriptionSettingsForm` entra como componente novo de configurações — interruptor por
empresa e escolha do modo, apresentacional como os outros forms daqui. `isAvailable`
distingue "o ambiente consegue" de "esta empresa quer": sem os dois, o lojista ligaria o
interruptor num ambiente sem engine, nada apareceria, e nada explicaria por quê.
