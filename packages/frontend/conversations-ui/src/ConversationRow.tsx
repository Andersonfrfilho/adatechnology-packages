/**
 * Linha da inbox operacional: o `ConversationListItem` cuida do visual padrão (avatar, prévia,
 * hora, não lidas) e aqui em volta ficam as affordances de trabalho — seleção em massa, sinal da
 * janela de 24h, tempo parada e retomada de atendimento.
 *
 * Fica no pacote, e não em cada produto, porque nada disto é regra de um negócio específico: é
 * como se opera uma fila de atendimento no WhatsApp.
 */

import { ConversationListItem } from './ConversationListItem'
import { capabilitiesOf } from './conversationChannel'
import { cn } from './lib/cn'
import { ChannelIcon } from './ChannelIcon'
import type { ConversationSummary } from './providers/types'
import {
  CONVERSATION_WINDOW,
  formatStalledFor,
  windowOf,
  type ConversationWindow,
} from './conversationWindow'


const WINDOW_TITLE: Record<ConversationWindow, string> = {
  [CONVERSATION_WINDOW.ALL]: '',
  [CONVERSATION_WINDOW.FRESH]: 'Janela de 24h aberta (menos de 12h)',
  [CONVERSATION_WINDOW.WARNING]: 'Janela de 24h fechando (12-21h)',
  [CONVERSATION_WINDOW.CRITICAL]: 'Janela de 24h quase expirada (21-24h)',
  [CONVERSATION_WINDOW.EXPIRED]: 'Janela de 24h expirada — só template',
}

// Abaixo disto a conversa é recente e o aviso de "parada" só faria ruído.
const STALLED_THRESHOLD_MS = 60 * 60 * 1000

const WINDOW_BAR_CLASS: Record<ConversationWindow, string> = {
  [CONVERSATION_WINDOW.ALL]: 'bg-transparent',
  [CONVERSATION_WINDOW.FRESH]: 'bg-green-500',
  [CONVERSATION_WINDOW.WARNING]: 'bg-yellow-500',
  [CONVERSATION_WINDOW.CRITICAL]: 'bg-red-500',
  [CONVERSATION_WINDOW.EXPIRED]: 'bg-gray-300',
}

export type ConversationRowClassNames = {
  root: string
  windowBar: string
}

export type ConversationRowProps = {
  conversation: ConversationSummary
  active: boolean
  selected: boolean
  now: number
  busy: boolean
  onOpen: () => void
  onToggleSelected: () => void
  onTakeover: () => void
  className?: string
  classNames?: Partial<ConversationRowClassNames>
}

export function ConversationRow({
  conversation,
  active,
  selected,
  now,
  busy,
  onOpen,
  onToggleSelected,
  onTakeover,
  className,
  classNames,
}: ConversationRowProps) {
  const capabilities = capabilitiesOf(conversation.channel)
  const window = windowOf({ lastInboundAt: conversation.lastInboundAt, now, channel: conversation.channel })
  const stalledMs = now - new Date(conversation.lastAt).getTime()
  // "Parada" é sobre a conversa estar sem resposta há tempo, independente de quem conduz. Amarrar
  // ao `waitingHuman` escondia justamente o caso ruim: conversa assumida e esquecida.
  const isStalled = stalledMs > STALLED_THRESHOLD_MS
  const isWaiting = conversation.mode === 'bot' && conversation.waitingHuman

  // Realce e hover ficam na linha inteira: com eles no item, só o bloco dele ficava cinza enquanto
  // checkbox, barra lateral e pills continuavam brancos — parecia meia linha selecionada.
  return (
    <div className={cn('cv-row flex border-b', active && 'cv-row--active', classNames?.root, className)}>
      {/* Barra lateral com a cor da janela: informa sem competir por espaço com o conteúdo, e não
          duplica as bolinhas que o próprio ConversationListItem já desenha. */}
      <span
        className={cn('w-1 shrink-0', WINDOW_BAR_CLASS[window], classNames?.windowBar)}
        title={WINDOW_TITLE[window]}
        aria-label={WINDOW_TITLE[window]}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 px-2 pt-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={`Selecionar conversa ${conversation.whatsappNumber}`}
            className="mt-3"
          />
          <div className="min-w-0 flex-1">
            {/* Sem divisória: a borda do item cortaria esta linha ao meio, separando-o do rodapé
                de status que pertence à mesma conversa. */}
            <ConversationListItem
              conversation={conversation}
              active={active}
              onClick={onOpen}
              showDivider={false}
              highlightActive={false}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2 pl-8">
          {/* Canal na linha: numa inbox multicanal, saber de onde a conversa veio muda o que o
              atendente pode fazer nela. */}
          <span className="cv-pill">
            <ChannelIcon channel={conversation.channel} /> {capabilities.label}
          </span>
          {conversation.mode === 'human' ? (
            <span className="cv-pill cv-pill--success">🧑‍💼 em atendimento</span>
          ) : null}
          {isWaiting ? <span className="cv-pill cv-pill--warning">⏳ aguardando atendimento</span> : null}
          {!isWaiting && conversation.mode === 'bot' ? <span className="cv-pill">🤖 bot ativo</span> : null}
          {isStalled ? (
            <span className="cv-pill cv-pill--danger">⏱️ parada há {formatStalledFor(conversation.lastAt, now)}</span>
          ) : null}
          {isWaiting ? (
            <button type="button" onClick={onTakeover} disabled={busy} className="cv-header-action">
              ▶️ Continuar Atendimento
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
