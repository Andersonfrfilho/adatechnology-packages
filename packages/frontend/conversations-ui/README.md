# @adatechnology/conversations-ui

Telas de conversa parametrizáveis por endpoint, tema e capacidades. Subpaths: `.` (inbox/mensagens),
`/flows`, `/whatsapp`, `/preview`, `/participant` e `/styles.css`.

## Visão do participante (`/participant`)

Tela de conversa do lado de **quem conversa com a empresa** (app do motorista, portal do cliente). Não usa
`ConversationsProvider`, não puxa `@xyflow/react` nem o `ConversationsWorkspace`, e não depende de Tailwind:
todas as classes são `.cv-p-*` e vêm de `@adatechnology/conversations-ui/styles.css`.

`@adatechnology/conversations-ui/styles.css` é **requisito**: sem ele a tela fica sem layout e o `MessageText` e o
`StatusTicks` perdem a formatação (negrito, itálico, tachado, tiques coloridos). Importe-o uma vez na raiz do app.

`MessageText` **copia ao tocar** por padrão (como na 0.3.1); `copyOnClick={false}` desliga. O aviso de cópia usa
`copiedLabel` (padrão `Copied`; passe `copiedLabel="Copiado!"` para manter o português).

### Uso mínimo

```tsx
import { ParticipantConversations } from '@adatechnology/conversations-ui/participant'
import '@adatechnology/conversations-ui/styles.css'

const SUBJECT_GROUPS = [
  { subjectType: 'invoice', label: 'Faturas' },
  { subjectType: 'trip', label: 'Viagens' },
] as const

function ConversationsRoute() {
  const { subjectType, subjectId } = useParams()
  const navigate = useNavigate()
  const selected = subjectType && subjectId ? { subjectType, subjectId } : undefined

  return (
    <ParticipantConversations
      api={participantApi}
      subjectGroups={SUBJECT_GROUPS}
      selected={selected}
      onSelect={(subject) => navigate(`/conversas/${subject.subjectType}/${subject.subjectId}`)}
      onBack={() => navigate('/conversas')}
    />
  )
}
```

### Contrato de roteamento

O componente é **controlado pela rota**: `selected === undefined` mostra a lista, definido mostra a conversa.
**Monte-o UMA vez acima das duas rotas** (`/conversas` e `/conversas/:subjectType/:subjectId`), com o mesmo
elemento. O cache da lista e os rascunhos por conversa (texto e anexos) vivem dentro dele; se cada rota
montasse a sua instância, voltar da conversa para a lista recarregaria tudo e perderia o rascunho.

```tsx
<Route path="/conversas" element={<ConversationsRoute />} />
<Route path="/conversas/:subjectType/:subjectId" element={<ConversationsRoute />} />
```

Capacidades opcionais existem **por ausência de prop**: sem `onBack` não há botão de voltar, sem
`renderSubjectCard` não há cartão do assunto, sem `onOpenSubject` o título não é clicável, sem
`quickReplies` não há faixa de respostas rápidas, sem `pendingMessages` não há fila do host. Sem
`api.subscribe`, a tela revalida ao montar e em `focus`, `visibilitychange` e `online`; com `subscribe`, revalida também em `online` (um evento pode ter se perdido) e marca como lido ao voltar a ficar visível. Sem
`api.openConversation`, uma conversa fora da primeira página da lista aparece como "não encontrada"
(`labels.notFound`).

### Adapter REST de `ParticipantConversationsApi`

```ts
import { z } from 'zod'

import { participantConversationPageSchema, participantMessageSchema } from '@adatechnology/conversation-contracts'
import type { ParticipantConversationsApi } from '@adatechnology/conversations-ui/participant'

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/v1${path}`, { ...init, credentials: 'include' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return ((await response.json()) as { data: unknown }).data
}

function conversationPath({ subjectType, subjectId }: { subjectType: string; subjectId: string }): string {
  return `/conversations/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}`
}

export const participantApi: ParticipantConversationsApi = {
  listConversations: async ({ cursor } = {}) =>
    participantConversationPageSchema.parse(
      await request(`/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
    ),
  fetchMessages: async (subject, { before, limit } = {}) =>
    z.array(participantMessageSchema).parse(
      await request(
        `${conversationPath(subject)}/messages?limit=${limit ?? 30}${before ? `&before=${encodeURIComponent(before)}` : ''}`,
      ),
    ),
  sendMessage: async ({ subject, clientMessageId, text }) => {
    const message = participantMessageSchema.parse(
      await request(`${conversationPath(subject)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': clientMessageId },
        body: JSON.stringify({ text }),
      }),
    )
    return { outcome: 'sent', message }
  },
  markRead: async (subject) => {
    await request(`${conversationPath(subject)}/read`, { method: 'POST' })
  },
  resolveAttachmentUrl: async (attachment) =>
    z.object({ url: z.string() }).parse(await request(`/attachments/${encodeURIComponent(attachment.id)}/url`)).url,
}
```

A resposta do servidor é entrada não confiável: valide com os schemas do `@adatechnology/conversation-contracts`
(`participantConversationPageSchema`, `participantMessageSchema`) e use `encodeURIComponent` em todo segmento de URL
que vem de `subjectType`, `subjectId`, cursor ou id.

**Eco de `clientMessageId` (obrigatório).** Toda mensagem criada por `sendMessage` volta com o `clientMessageId`
recebido (o mesmo valor do `Idempotency-Key`): é por ele que a bolha local é substituída pela mensagem do servidor.
Sem o eco, a bolha local fica duplicada ao lado da mensagem real. O servidor também precisa tratar com segurança
duas requisições simultâneas com a mesma chave (toque duplo, reenvio): uma cria, a outra devolve a mesma mensagem.

Ao tocar em enviar, o campo é limpo na hora e a **bolha passa a ser a dona** do texto e dos arquivos (o segundo
toque não envia nada). `sendMessage` que lança significa falha: a bolha mostra "reenviar" (repete o **mesmo**
`clientMessageId`; use-o como `Idempotency-Key`), "editar" (devolve texto e arquivos ao campo e remove a bolha) e
"descartar". Uma bolha que falhou sobrevive a sair e voltar da conversa. Para guardar na fila offline do host,
devolva `{ outcome: 'queued' }` e devolva a fila durável em `pendingMessages`: a bolha fica como "na fila" até o host
ou o servidor refletirem o mesmo `clientMessageId`. Falha de uma mensagem que veio do servidor mostra só "Falhou";
falha de uma pendente do host só ganha "reenviar" se `onRetryPending` for passado. O pacote não conhece IndexedDB.

`api` **precisa ser estável** (crie o adapter uma vez, fora do render, ou memorize-o): uma instância nova a cada
render refaz a carga da lista e reinscreve os eventos de `subscribe` a cada renderização. Métodos de adapter escritos como classe funcionam, o pacote preserva o `this`.

### Aviso: `direction` é sempre na perspectiva da empresa

`ParticipantMessage.direction` descreve a mensagem **do ponto de vista da empresa**: `inbound` chegou à
empresa, ou seja, foi escrita pelo participante (é a bolha "minha"); `outbound` saiu da empresa. O adapter do
app **não inverte nada**.

### Variáveis `--cv-p-*`

Defina no `.cv-p`, no wrapper (`className`) ou em qualquer ancestral. Há também a prop `theme`
(`primaryColor` → `--cv-p-accent`, `backgroundColor` → `--cv-p-surface`, `textPrimary` → `--cv-p-text`,
`textSecondary` → `--cv-p-text-muted`).

| Variável | Para que serve | Padrão (claro) |
| --- | --- | --- |
| `--cv-p-surface` | fundo da tela | `#ffffff` |
| `--cv-p-surface-raised` | fundo de bolhas recebidas e campos | `#f3f4f6` |
| `--cv-p-text` | texto principal | `#111827` |
| `--cv-p-text-muted` | texto secundário | `#5b6573` |
| `--cv-p-border` | bordas | `#d5d9df` |
| `--cv-p-accent` | destaque, botão primário, bolha própria | `#a85a1c` |
| `--cv-p-accent-contrast` | texto sobre o destaque | `#ffffff` |
| `--cv-p-highlight` | fundo de "espera sua resposta" | `#fbefe2` |
| `--cv-p-danger` | erro e falha de envio | `#c62828` |
| `--cv-p-radius` | raio dos cantos | `0` |

O tema escuro segue a classe `.dark` (mesma do restante do pacote). Os nomes `.cv-p-*` e `--cv-p-*` são API
pública e não mudam sem nova versão maior.

### Aviso: `ConversationChannel` foi ampliado

`ConversationChannel` agora inclui `'app'` e `'portal'`. Quem tem um `switch` exaustivo sobre o tipo (sem
`default`) passa a ter erro de compilação até tratar os dois novos valores. Quem só escreve o tipo não é
afetado.
