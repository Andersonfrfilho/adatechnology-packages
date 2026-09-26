---
'@adatechnology/conversation-contracts': minor
'@adatechnology/conversation-module': minor
---

Nasce o núcleo de conversa (spec 211, ADR-0085): dois pacotes novos, `conversation-contracts`
(vocabulário, portas, zero runtime) e `conversation-module` (schema, migrations, casos de uso),
channel-agnostic e subject-agnostic — o que a conversa é _sobre_ chega como par opaco
(`subject_type`/`subject_id`), nunca uma palavra de produto dentro (CA01).

Entra nesta versão:

- **Vocabulário e capacidades por canal**: `email`, `whatsapp`, `app`, `portal`, `webchat`, com uma
  tabela declarativa por canal — confirma leitura, tem janela de atendimento (e de quantas horas),
  aceita anexo (e o teto), aceita áudio, aceita resposta rápida, precisa de transporte próprio
  (`requiresTransport`). A tela consome essa tabela para desabilitar com dica em vez de esconder
  sem explicação.
- **Máquina de status de entrega** que só avança (`queued → sent → delivered → read`, `failed`),
  idempotente por `(canal, id do provedor)`.
- **Portas**: `ConversationChannelPort` (canal comum), `ConversationEmailTransportPort` (D5 — o
  canal `email` exige o próprio transporte), `ClockPort`, `ObjectStoragePort`, `TranscriberPort`
  (opcional — ausente é anexo sem texto, nunca texto fingido).
- **Schema e migrations** de conversa, participante, mensagem, anexo, leitura, fila de não
  atribuídas e resposta rápida, sem FK para tabela de produto.
- **Casos de uso** atrás de porta, compostos por `createConversationModule(...)`: abrir conversa,
  enviar, receber, atualizar status, atribuir, marcar lido, listar — "porta ausente desliga o
  recurso" (nunca uma flag `hasX`).
- **Atribuição genérica**: por referência de resposta; sem ela, à conversa aberta mais recente do
  identificador; ambígua, fila de não atribuídas — nunca por palpite.
- **Anexo** com `sha256`, tipo conferido pelo conteúdo (nunca pela extensão), teto por canal, URL
  temporária, nenhum byte no banco.
- **Respostas rápidas** por público, com posição e ativo.
- **Token derivado do endereço de resposta de e-mail** (HMAC, determinístico) e a verificação por
  comparação de tempo constante — nunca sorteado.
- **Threading RFC 5322** (`In-Reply-To`/`References`) da última mensagem recebida, com teto de
  50 entradas.
- **MIME bruto** gravado com `sha256` antes de qualquer interpretação, e a extração de anexo do
  multipart reaproveitando a política de tipo já existente.
- **DKIM** (`aligned | not_aligned | unverifiable | absent`) com fixtures sintéticas de chave e DNS
  injetado — o veredito não se refaz depois, porque a chave pode ter girado.
- **A exigência do transporte na subida** (D5, CA03): ligar o canal `email` sem
  `ConversationEmailTransportPort` falha em `createConversationModule(...)`, nomeando o canal e a
  porta que falta — checagem dirigida pela capacidade `requiresTransport` de cada canal, não por
  uma lista escrita à mão.
