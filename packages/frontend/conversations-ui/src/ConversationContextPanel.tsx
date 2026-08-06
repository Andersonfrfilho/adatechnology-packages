/**
 * "Suas Seleções": o que o bot já coletou na conversa. Para o atendente que assume no meio, é a
 * diferença entre ler o transcript inteiro e ver o estado de relance.
 *
 * O pacote não interpreta o contexto — ele é `Record<string, unknown>` e cada produto nomeia as
 * próprias chaves. O host traduz para `entries`; aqui só se decide como mostrar.
 *
 * Desenho em paridade com financiamento-imobiliario-bot/apps/web/src/components/SelectionsSummary.tsx:
 * card com gradiente, badge de contagem, pills de status no cabeçalho e grid de cards com borda
 * colorida por estado. O que ficou diferente de lá, e por quê, está comentado no ponto.
 */

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Clock, Pencil } from 'lucide-react'

import { cn } from './lib/cn'
import { useIsNarrow } from './useIsNarrow'

/**
 * `completed` tem valor, `pending` ainda não foi coletado, `editing` é o cliente refazendo a
 * resposta. O host só precisa mandar `status` para o terceiro caso — os dois primeiros saem do
 * próprio `value`, e exigir o campo quebraria quem já usa o painel.
 */
export type ConversationContextStatus = 'completed' | 'pending' | 'editing'

export interface ConversationContextEntry {
  key: string
  label: string
  value?: string | undefined
  icon?: string
  status?: ConversationContextStatus
}

export interface ConversationContextPanelLabels {
  title: string
  empty: string
  collapse: string
  expand: string
  /** Placeholder do card ainda não coletado. */
  notCollected: string
}

export const DEFAULT_CONVERSATION_CONTEXT_LABELS: ConversationContextPanelLabels = {
  title: 'Suas Seleções',
  empty: 'Nada coletado ainda nesta conversa.',
  collapse: 'fechar',
  expand: 'abrir',
  notCollected: 'a coletar',
}

export interface ConversationContextPanelClassNames {
  root: string
  toggle: string
  counter: string
  body: string
}

export interface ConversationContextPanelProps {
  entries: readonly ConversationContextEntry[]
  /**
   * Estado inicial. Ausente, abre sozinho no desktop quando há algum dado preenchido.
   *
   * Existe porque "abre sozinho" nem sempre é o que o produto quer: com 1 de 6 campos preenchidos o
   * painel ocupa altura mostrando quase só pendências, e empurra a conversa — que é o que se veio ver.
   */
  defaultOpen?: boolean
  /**
   * Rótulo do fluxo em curso, exibido em azul ao lado do título — no financiamento é o produto
   * escolhido ("Consórcio", "MCMV"). Ausente, o cabeçalho fica só com título e contagens.
   */
  flowLabel?: string
  labels?: Partial<ConversationContextPanelLabels>
  className?: string
  classNames?: Partial<ConversationContextPanelClassNames>
}

function statusOf(entry: ConversationContextEntry): ConversationContextStatus {
  if (entry.status) return entry.status
  return entry.value ? 'completed' : 'pending'
}

/** Borda e fundo do card por estado. Pendente é tracejado — ver o comentário no grid. */
const CARD_STYLE: Record<ConversationContextStatus, string> = {
  completed: 'bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-800 shadow-sm',
  editing: 'bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-800 shadow-sm',
  pending: 'border-2 border-dashed border-gray-200 bg-white/40 dark:border-gray-700 dark:bg-gray-800/30',
}

const GLYPH_STYLE: Record<ConversationContextStatus, string> = {
  completed: 'text-green-600 dark:text-green-400',
  editing: 'text-blue-600 dark:text-blue-400',
  pending: 'text-gray-400 dark:text-gray-500',
}

function StatusGlyph({ status }: { status: ConversationContextStatus }) {
  const size = 11
  if (status === 'completed') return <Check size={size} aria-hidden />
  if (status === 'editing') return <Pencil size={size} aria-hidden />
  return <Clock size={size} aria-hidden />
}

function CountPill({
  status,
  count,
  className,
}: {
  status: ConversationContextStatus
  count: number
  className: string
}) {
  if (count === 0) return null

  return (
    <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      <StatusGlyph status={status} />
      {count}
    </span>
  )
}

export function ConversationContextPanel({
  entries,
  defaultOpen,
  flowLabel,
  labels: labelsOverride,
  className,
  classNames,
}: ConversationContextPanelProps) {
  const labels = { ...DEFAULT_CONVERSATION_CONTEXT_LABELS, ...labelsOverride }

  const counts = { completed: 0, pending: 0, editing: 0 }
  for (const entry of entries) counts[statusOf(entry)] += 1

  // Abre sozinho só quando há algo coletado: um painel de seis pendências ocupa a altura da conversa
  // sem informar nada. As contagens continuam visíveis fechado, que é o dado útil de relance.
  //
  // `undefined` = usuário ainda não mexeu. Guardar só um booleano não serve: o contexto chega
  // depois da montagem, então o estado inicial seria calculado com a lista vazia e o painel ficaria
  // fechado mesmo com dados.
  const isNarrow = useIsNarrow()
  const [manualOpen, setManualOpen] = useState<boolean | undefined>(undefined)
  // No celular nasce fechado mesmo com dados: aberto, o painel consome ~150px da conversa.
  const open = manualOpen ?? defaultOpen ?? (!isNarrow && counts.completed > 0)

  return (
    // Faixa azul clara com separador, como o wrapper do financiamento: sem ela o card encostava
    // direto no papel de parede da conversa e os dois blocos se misturavam.
    <div className={cn('border-b bg-blue-50/60 px-3 py-3 dark:border-gray-700 dark:bg-blue-950/20', className)}>
      <section
        className={cn(
          'overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-blue-900 dark:from-blue-950/30 dark:to-indigo-950/30',
          classNames?.root,
        )}
      >
        <button
          type="button"
          onClick={() => setManualOpen(!open)}
          aria-expanded={open}
          data-cv-tooltip={open ? labels.collapse : labels.expand} aria-label={open ? labels.collapse : labels.expand}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-blue-100/40 dark:hover:bg-blue-900/20',
            classNames?.toggle,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              📋
            </span>
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.title}</span>
            {flowLabel ? (
              <span className="truncate text-xs font-medium text-blue-600 dark:text-blue-400">{flowLabel}</span>
            ) : null}
            <span
              className={cn(
                'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white',
                classNames?.counter,
              )}
            >
              {entries.length}
            </span>
          </span>

          <span className="flex flex-shrink-0 items-center gap-2">
            <CountPill
              status="completed"
              count={counts.completed}
              className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            />
            <CountPill
              status="editing"
              count={counts.editing}
              className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <CountPill
              status="pending"
              count={counts.pending}
              className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            />
            {open ? (
              <ChevronUp size={15} className="flex-shrink-0 text-blue-500" aria-hidden />
            ) : (
              <ChevronDown size={15} className="flex-shrink-0 text-blue-500" aria-hidden />
            )}
          </span>
        </button>

        {open ? (
          /**
           * Teto de altura com rolagem interna, como no financiamento (`max-h-64 overflow-y-auto`).
           * Sem isso o painel cresce sem limite — e cresce de verdade: o host anexa as chaves de
           * contexto que ele não conhece ao fim da lista, então uma conversa com bastante estado
           * empurrava a conversa inteira para fora da tela.
           *
           * A diferença: lá o teto envolve o cabeçalho também, então ele rola junto e sai de vista.
           * Aqui só o corpo rola — o cabeçalho é o que fecha o painel, e perder o clique de fechar
           * no meio da rolagem é pior do que a economia de uma linha de markup.
           */
          <div
            className={cn(
              'cv-scrollbar-thin max-h-64 overflow-y-auto border-t border-blue-200 px-4 pb-4 pt-1 dark:border-blue-900',
              classNames?.body,
            )}
          >
            {entries.length === 0 ? (
              <p className="pt-2 text-xs text-gray-500 dark:text-gray-400">{labels.empty}</p>
            ) : (
              /**
               * Três colunas no desktop, como no financiamento — com duas, seis campos viravam uma
               * coluna alta que empurrava a conversa.
               *
               * O que não fizemos igual: lá o painel FILTRA o que não foi coletado, porque a fonte
               * só guarda o que o cliente respondeu. Aqui a lista de campos é conhecida de antemão,
               * e "falta endereço" é justamente o que o atendente precisa ver ao assumir. Então o
               * pendente aparece — tracejado e apagado, para ler como lacuna e não como dado.
               */
              <dl className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
                {entries.map((entry) => {
                  const status = statusOf(entry)

                  return (
                    <div
                      key={entry.key}
                      className={cn('min-w-0 rounded-lg p-2.5 transition-all', CARD_STYLE[status])}
                    >
                      <dt className="mb-1 flex items-center justify-center gap-1">
                        {entry.icon ? (
                          <span aria-hidden className="text-base leading-none">
                            {entry.icon}
                          </span>
                        ) : null}
                        <span className="truncate text-[10px] font-medium uppercase leading-none tracking-wide text-gray-500 dark:text-gray-400">
                          {entry.label}
                        </span>
                        <span className={cn('flex-shrink-0 leading-none', GLYPH_STYLE[status])}>
                          <StatusGlyph status={status} />
                        </span>
                      </dt>
                      {/* `title` no valor: truncado no card, o texto completo só existe no tooltip. */}
                      <dd
                        className={cn(
                          'truncate text-center text-xs font-semibold',
                          entry.value
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'italic font-normal text-gray-400 dark:text-gray-500',
                        )}
                        data-cv-tooltip={entry.value ?? labels.notCollected}
                      >
                        {entry.value ?? labels.notCollected}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
