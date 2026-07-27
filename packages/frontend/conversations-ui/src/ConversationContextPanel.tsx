/**
 * "Suas Seleções": o que o bot já coletou na conversa. Para o atendente que assume no meio, é a
 * diferença entre ler o transcript inteiro e ver o estado em duas linhas.
 *
 * O pacote não interpreta o contexto — ele é `Record<string, unknown>` e cada produto nomeia as
 * próprias chaves. O host traduz para `entries`; aqui só se decide como mostrar.
 */

import { useState } from 'react'

import { cn } from './lib/cn'
import { useIsNarrow } from './useIsNarrow'

export interface ConversationContextEntry {
  key: string
  label: string
  value?: string | undefined
  icon?: string
}

export interface ConversationContextPanelLabels {
  title: string
  empty: string
}

export const DEFAULT_CONVERSATION_CONTEXT_LABELS: ConversationContextPanelLabels = {
  title: '📋 Suas Seleções',
  empty: 'Nada coletado ainda nesta conversa.',
}

export interface ConversationContextPanelClassNames {
  root: string
  toggle: string
  counter: string
  body: string
}

export interface ConversationContextPanelProps {
  entries: readonly ConversationContextEntry[]
  labels?: Partial<ConversationContextPanelLabels>
  className?: string
  classNames?: Partial<ConversationContextPanelClassNames>
}

export function ConversationContextPanel({
  entries,
  labels: labelsOverride,
  className,
  classNames,
}: ConversationContextPanelProps) {
  const labels = { ...DEFAULT_CONVERSATION_CONTEXT_LABELS, ...labelsOverride }
  const filled = entries.filter((entry) => Boolean(entry.value))

  // Abre sozinho só quando há algo coletado: um painel de seis traços ocupa a altura da conversa
  // sem informar nada. O contador continua visível fechado, que é o dado útil de relance.
  //
  // `undefined` = usuário ainda não mexeu. Guardar só um booleano não serve: o contexto chega
  // depois da montagem, então o estado inicial seria calculado com a lista vazia e o painel ficaria
  // fechado mesmo com dados.
  const isNarrow = useIsNarrow()
  const [manualOpen, setManualOpen] = useState<boolean | undefined>(undefined)
  // No celular nasce fechado mesmo com dados: aberto, o painel consome ~150px da conversa. O
  // contador no cabeçalho já entrega a informação de relance.
  const open = manualOpen ?? (!isNarrow && filled.length > 0)

  return (
    <section className={cn('border-b', classNames?.root, className)}>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium', classNames?.toggle)}
      >
        <span aria-hidden className="text-xs">
          {open ? '▾' : '▸'}
        </span>
        <span>{labels.title}</span>
        <span className={cn('rounded-full bg-gray-200 px-2 text-xs dark:bg-gray-700', classNames?.counter)}>
          {filled.length}/{entries.length}
        </span>
      </button>

      {open ? (
        <div className={cn('px-4 pb-3', classNames?.body)}>
          {entries.length === 0 ? (
            <p className="text-xs text-gray-500">{labels.empty}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {entries.map((entry) => (
                <div key={entry.key} className="min-w-0">
                  <dt className="truncate text-gray-500">
                    {entry.icon ? `${entry.icon} ` : ''}
                    {entry.label}
                  </dt>
                  <dd className="truncate font-medium">
                    {entry.value ? <span className="text-green-700 dark:text-green-400">✓ {entry.value}</span> : '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ) : null}
    </section>
  )
}
