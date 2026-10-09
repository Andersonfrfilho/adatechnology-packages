# @adatechnology/conversations-ui

Telas de conversa parametrizáveis por endpoint, tema e capacidades. Subpaths: `.` (inbox/mensagens),
`/flows`, `/whatsapp`, `/preview`, `/participant` e `/styles.css`.

## Visão do participante (`/participant`)

Tela de conversa do lado de **quem conversa com a empresa** (app do motorista, portal do cliente). Não usa
`ConversationsProvider`, não puxa `@xyflow/react` nem o `ConversationsWorkspace`, e não depende de Tailwind:
todas as classes são `.cv-p-*` e vêm de `@adatechnology/conversations-ui/styles.css`.

`@adatechnology/conversations-ui/styles.css` é **requisito da visão do participante**: sem ele a tela fica sem layout.
A visão do participante renderiza `MessageText` e `StatusTicks` com `appearance="stylesheet"` (classes `.cv-*`, sem
Tailwind). Fora dela, os dois componentes mantêm o padrão da 0.4.2 (classes Tailwind do host).

Props opt-in (o padrão é sempre o comportamento da 0.4.2):

- `MessageText`: `appearance?: 'tailwind' | 'stylesheet'` (padrão `'tailwind'`); `accessibleCopy?: boolean` (padrão
  `false`; liga `role="button"`, `tabIndex=0` e Enter/Espaço para copiar); `copyOnClick` (padrão `true`; `false`
  desliga a cópia); `copiedLabel` (padrão `Copiado!`).
- `StatusTicks`: `appearance?: 'tailwind' | 'stylesheet'` (padrão `'tailwind'`). Só em `'stylesheet'` valem o estado
  `queued` (relógio), `bounced` tratado como `failed` e o `aria-label`; `queuedLabel?: string` (padrão `Queued`) define
  o rótulo do relógio. No padrão, qualquer status diferente de `sent` e `failed` desenha dois tiques, como na 0.4.2; em `'stylesheet'`, um status desconhecido cai em `sent` (um tique).

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
    z
      .array(participantMessageSchema)
      .parse(
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

Limites do host: devolver `queued` sem refletir a mensagem em `pendingMessages` deixa uma bolha "na fila" sem
nenhuma ação até a conversa desmontar (ela segura os `File`); `sendMessage` precisa terminar com timeout (uma
promise que nunca resolve trava o botão de enviar daquele assunto); e se o host tira a mensagem da fila antes de o
servidor refletir, deve emitir `conversation-changed` para a conversa recarregar.

`api` **precisa ser estável** (crie o adapter uma vez, fora do render, ou memorize-o): uma instância nova a cada
render refaz a carga da lista e reinscreve os eventos de `subscribe` a cada renderização. Métodos de adapter escritos como classe funcionam, o pacote preserva o `this`.

### Aviso: `direction` é sempre na perspectiva da empresa

`ParticipantMessage.direction` descreve a mensagem **do ponto de vista da empresa**: `inbound` chegou à
empresa, ou seja, foi escrita pelo participante (é a bolha "minha"); `outbound` saiu da empresa. O adapter do
app **não inverte nada**.

### Protocolo legível da conversa

`ParticipantConversationSummary.protocol?` (1 a 32 caracteres, `[A-Za-z0-9-]`, ex.: `261009-K7M2`) é um código
curto para citar a conversa por telefone ou mensagem. **Quem gera é o produto, no servidor, uma vez e imutável**: o
pacote nunca gera nem conhece o formato, só **exibe, copia e busca**. Campo ausente = nada é desenhado.

- **Lista:** a linha mostra o protocolo abaixo do título (fonte mono); o prefixo `labels.protocolPrefix` é um `<span>` só para
  leitor de tela (sem `aria-label` em elemento genérico, que o ARIA 1.2 proíbe).
- **Cabeçalho da conversa:** protocolo abaixo do título e botão de copiar (alvo de 44px) que usa
  `navigator.clipboard.writeText`; falha de cópia é silenciosa. Durante 3 s o texto visível do botão vira
  `labels.protocolCopied` (o nome acessível segue "`copyProtocol` + código") e o aviso também vai numa região
  `aria-live="polite"` sempre na árvore; copiar de novo dentro dos 3 s reinicia o prazo e reanuncia.
- **Busca:** um campo `type="search"` acima da lista filtra por título (sem acento nem caixa) **ou** protocolo
  (parcial, sem traço, sem caixa: `k7m2` acha `261009-K7M2`). Aparece só quando alguma conversa tem `protocol` ou
  há mais de 8 conversas na lista; sem nada disso, nada é desenhado. Sem resultado: `labels.noResults`.
  - Os chips de assunto e suas contagens são sempre calculados sobre **todas** as conversas carregadas; a busca só
    restringe as linhas. Se o chip ativo não contém o que a busca acha (mas outro assunto contém), os chips continuam
    visíveis e o estado vazio mostra `labels.noResultsInFilter` ("tente Todas") em vez de esconder a barra.
  - O campo permanece enquanto houver consulta, mesmo que um refresh reduza a lista abaixo do limiar.
  - **Limitação:** a busca cobre só as conversas já carregadas. Com `hasMore` e sem resultado, o estado vazio mostra
    `labels.noResultsLoadedOnly` e o botão "carregar mais" fica à mão. Busca no servidor fica como evolução.
- **Labels novas** (defaults em inglês): `searchLabel`, `searchPlaceholder`, `noResults`, `noResultsInFilter`,
  `noResultsLoadedOnly`, `protocolPrefix`, `copyProtocol` (padrão "Copy protocol"), `protocolCopied`.
- **Classes novas:** `.cv-p-protocol`, `.cv-p-protocol__copy`, `.cv-p-search` (mesmos tokens `--cv-p-*`).

### Canais e ícone do assunto na lista

`ParticipantConversationSummary.channels?` (até 5 canais do vocabulário `email | whatsapp | app | portal | webchat`, sem
repetição, pode ser vazio) e `iconName?` (1 a 32 caracteres, `[a-z0-9-]`, nome **opaco**: o pacote não conhece o
catálogo) chegam **calculados pelo servidor**: `channels` são os canais distintos das mensagens da conversa e
`iconName` o nome escolhido pelo produto para o assunto. **O pacote não deduz nada**; campo ausente = nada é desenhado.

- **Lista:** a linha mostra à esquerda o ícone do assunto e, ao lado do protocolo, os selos de canal. O ícone vem de
  `renderSubjectIcon?: (conversation) => ReactNode` (em `ParticipantConversations`); se a prop faltar, ou devolver
  `null`/`undefined`, cai no ícone do grupo (`subjectGroups[].icon`). O host usa `conversation.iconName` para escolher.
- **Selos de canal:** um por canal, na ordem fixa app, whatsapp, email, portal, webchat (duplicata e canal desconhecido são
  ignorados). O sinal visual é o ícone (cor é só reforço); o nome do canal está sempre em `<span class="cv-p-sr-only">`.
  Sem `channels` ou vazio, nada é desenhado. Duas marcações (`ParticipantChannelBadges variant`): no **cabeçalho** da
  conversa, `<ul class="cv-p-channels" aria-label>` com `<li class="cv-p-channel cv-p-channel--{canal}">`; na **linha** da
  lista (dentro de um `<button>`, onde lista não é HTML válido), `<span class="cv-p-channels">` com `<span class="cv-p-channel
cv-p-channel--{canal}">`, um prefixo sr-only `Channels in this conversation: ` e o nome seguido de vírgula e espaço, para
  o leitor dizer "Channels in this conversation: App, WhatsApp".
- **`renderSubjectIcon`** deve ser **puro e não lançar** (o pacote não tem error boundary); `null`, `undefined`, `false` e
  `''` valem como ausente.
- **Cabeçalho da conversa:** os mesmos selos ao lado do protocolo.
- **Labels novas** (defaults em inglês): `channelsGroup` ("Channels in this conversation"), `channelApp`,
  `channelWhatsapp`, `channelEmail`, `channelPortal`, `channelWebchat`.
- **Classes novas:** `.cv-p-channels`, `.cv-p-channel`, `.cv-p-row__tags`, `.cv-p-inbox__icon`; cores opcionais
  `--cv-p-channel-app` (padrão: o destaque) e `--cv-p-channel-whatsapp` (padrão `#20914f`, ≥ 3:1 sobre as superfícies claras e
  escuras; ao trocar, mantenha 3:1).

### Variáveis `--cv-p-*`

Defina no `.cv-p`, no wrapper (`className`) ou em qualquer ancestral. Há também a prop `theme`
(`primaryColor` → `--cv-p-accent`, `backgroundColor` → `--cv-p-surface`, `textPrimary` → `--cv-p-text`,
`textSecondary` → `--cv-p-text-muted`).

| Variável                  | Para que serve                          | Padrão (claro) |
| ------------------------- | --------------------------------------- | -------------- |
| `--cv-p-surface`          | fundo da tela                           | `#ffffff`      |
| `--cv-p-surface-raised`   | fundo de bolhas recebidas e campos      | `#f3f4f6`      |
| `--cv-p-text`             | texto principal                         | `#111827`      |
| `--cv-p-text-muted`       | texto secundário                        | `#5b6573`      |
| `--cv-p-border`           | bordas                                  | `#d5d9df`      |
| `--cv-p-accent`           | destaque, botão primário, bolha própria | `#a85a1c`      |
| `--cv-p-accent-contrast`  | texto sobre o destaque                  | `#ffffff`      |
| `--cv-p-highlight`        | fundo de "espera sua resposta"          | `#fbefe2`      |
| `--cv-p-danger`           | erro e falha de envio                   | `#c62828`      |
| `--cv-p-radius`           | raio dos cantos                         | `0`            |
| `--cv-p-channel-app`      | cor do selo do canal app                | o destaque     |
| `--cv-p-channel-whatsapp` | cor do selo do canal WhatsApp           | `#20914f`      |

O tema escuro segue a classe `.dark` (mesma do restante do pacote). Os nomes `.cv-p-*` e `--cv-p-*` são API
pública e não mudam sem nova versão maior.

### Aviso: `ConversationChannel` foi ampliado

`ConversationChannel` agora inclui `'app'` e `'portal'`. Quem tem um `switch` exaustivo sobre o tipo (sem
`default`) passa a ter erro de compilação até tratar os dois novos valores. Quem só escreve o tipo não é
afetado.
