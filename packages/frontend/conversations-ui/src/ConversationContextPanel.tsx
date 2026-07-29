/**
 * "Suas Seleções": o que o bot já coletou na conversa. Para o atendente que assume no meio, é a
 * diferença entre ler o transcript inteiro e ver o estado em duas linhas.
 *
 * O pacote não interpreta o contexto — ele é `Record<string, unknown>` e cada produto nomeia as
 * próprias chaves. O host traduz para `entries`; aqui só se decide como mostrar.
 */

import { useState } from 'react'

import { cn } from './lib/cn'

export interface ConversationContextEntry {
  key: string
  label: string
  value?: string | undefined
  icon?: string
}

export interface ConversationContextPanelLabels {
  title: string
  empty: string
  collapse: string
  expand: string
}

export const DEFAULT_CONVERSATION_CONTEXT_LABELS: ConversationContextPanelLabels = {
  title: '📋 Suas Seleções',
  empty: 'Nada coletado ainda nesta conversa.',
  collapse: 'fechar',
  expand: 'abrir',
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
   * painel ocupa altura mostrando quase só travessões, e empurra a conversa — que é o que se veio ver.
   */
  defaultOpen?: boolean
  labels?: Partial<ConversationContextPanelLabels>
  className?: string
  classNames?: Partial<ConversationContextPanelClassNames>
}

export function ConversationContextPanel({
  entries,
  defaultOpen,
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
  const [manualOpen, setManualOpen] = useState<boolean | undefined>(undefined)
  // Nasce FECHADO, em qualquer tamanho de tela. Antes abria sozinho no desktop quando havia algum
  // campo preenchido, e o efeito era o painel ocupar ~200px mostrando quase só travessões — com 1 de
  // 6 campos, empurrava para baixo a conversa, que é o que se veio ver. O contador no cabeçalho
  // (`1/6`) já entrega a informação de relance, e agora o rótulo `abrir` diz como ver o detalhe.
  //
  // O padrão vive AQUI e não em cada host: se cada produto decidisse, a mesma tela nasceria diferente
  // em cada projeto — e a decisão certa é a mesma para todos.
  const open = manualOpen ?? defaultOpen ?? false

  return (
    <section className={cn('border-b', classNames?.root, className)}>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        title={open ? labels.collapse : labels.expand}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
          classNames?.toggle,
        )}
      >
        <span aria-hidden className="text-xs">
          {open ? '▾' : '▸'}
        </span>
        <span>{labels.title}</span>
        <span className={cn('rounded-full bg-gray-200 px-2 text-xs dark:bg-gray-700', classNames?.counter)}>
          {filled.length}/{entries.length}
        </span>
        {/* Rótulo escrito na ponta direita: o caret sozinho não dizia que a linha inteira fecha o
            painel — a pergunta "cadê o botão de fechar?" veio daí. */}
        <span aria-hidden className="ml-auto text-xs text-gray-500">
          {open ? labels.collapse : labels.expand}
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
