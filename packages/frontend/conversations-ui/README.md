# @adatechnology/conversations-ui

Telas de conversa parametrizáveis por endpoint, tema e capacidades. Subpaths: `.` (inbox/mensagens),
`/flows`, `/whatsapp`, `/preview`, `/participant` e `/styles.css`.

## Visão do participante (`/participant`)

Tela de conversa do lado de **quem conversa com a empresa** (app do motorista, portal do cliente). Não usa
`ConversationsProvider`, não puxa `@xyflow/react` nem o `ConversationsWorkspace`, e não depende de Tailwind:
todas as classes são `.cv-p-*` e vêm de `@adatechnology/conversations-ui/styles.css`.

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
`api.subscribe`, a tela revalida ao montar e em `focus`, `visibilitychange` e `online`. Sem
`api.openConversation`, uma conversa fora da primeira página da lista aparece como "não encontrada"
(`labels.notFound`).

### Adapter REST de `ParticipantConversationsApi`

```ts
import type { ParticipantConversationsApi, ParticipantMessage } from '@adatechnology/conversations-ui/participant'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { ...init, credentials: 'include' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return ((await response.json()) as { data: T }).data
}

export const participantApi: ParticipantConversationsApi = {
  listConversations: ({ cursor } = {}) =>
    request(`/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  fetchMessages: ({ subjectType, subjectId }, { before, limit } = {}) =>
    request(`/conversations/${subjectType}/${subjectId}/messages?limit=${limit ?? 30}${before ? `&before=${before}` : ''}`),
  sendMessage: async ({ subject, clientMessageId, text }) => {
    const message = await request<ParticipantMessage>(
      `/conversations/${subject.subjectType}/${subject.subjectId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': clientMessageId },
        body: JSON.stringify({ text }),
      },
    )
    return { outcome: 'sent', message }
  },
  markRead: ({ subjectType, subjectId }) =>
    request(`/conversations/${subjectType}/${subjectId}/read`, { method: 'POST' }),
  resolveAttachmentUrl: async (attachment) => (await request<{ url: string }>(`/attachments/${attachment.id}/url`)).url,
}
```

`sendMessage` que lança significa falha: a bolha mostra "toque para reenviar" e o reenvio repete o **mesmo**
`clientMessageId` (use-o como `Idempotency-Key`). Para guardar na fila offline do host, devolva
`{ outcome: 'queued' }` e devolva a fila durável em `pendingMessages`. O pacote não conhece IndexedDB.

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
