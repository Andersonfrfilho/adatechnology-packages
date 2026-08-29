import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus, MessageCircleQuestion, GitBranch, Zap, Diamond, ChevronRight } from 'lucide-react'

import { placeFloatingPanel, type FloatingPlacement } from './flowMenuPlacement'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'
import type { FlowActionKind, FlowQuestionType } from './flowGraph'

export type NewNodeSpec =
  | { kind: 'question'; questionType: FlowQuestionType }
  | { kind: 'decision' }
  | { kind: 'condition' }
  | { kind: 'action'; actionKind: FlowActionKind }

export interface FlowPaletteActionOption {
  actionKind: FlowActionKind
  label: string
}

export interface FlowPaletteProps {
  onAdd: (spec: NewNodeSpec) => void
  labels?: Partial<FlowEditorLabels>
  // Kinds de ação oferecidos no submenu "Ação" — o host declara os próprios (ex.: o bot
  // registraria 'trigger_simulation' aqui). Sem isso, o pacote não assume nenhum caso de
  // negócio específico além do genérico 'handoff'.
  actionOptions?: FlowPaletteActionOption[]
}

const QUESTION_TYPES: FlowQuestionType[] = ['text', 'money', 'date', 'int', 'cpf']

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/flows/FlowPalette.tsx —
// botão "Adicionar" com submenus por categoria (Pergunta/Decisão/Condição/Ação). Sem
// dependência de dropdown externa — menu simples com fechamento por clique fora.
export interface FlowPaletteMenuProps {
  onSelect: (spec: NewNodeSpec) => void
  labels: FlowEditorLabels
  actionOptions?: FlowPaletteActionOption[]
}

/**
 * A lista de tipos de nó, sem o botão que a abre.
 *
 * Separada porque o "+" do card abre exatamente esta lista: duplicar os itens era garantir que um
 * tipo novo aparecesse num caminho e faltasse no outro.
 */
export function FlowPaletteMenu({ onSelect, labels, actionOptions }: FlowPaletteMenuProps) {
  const resolvedActionOptions = actionOptions ?? [
    { actionKind: 'handoff', label: labels.actionKindLabels.handoff ?? 'Encaminhar para atendimento' },
  ]
  const [submenu, setSubmenu] = useState<'question' | 'action' | null>(null)
  const questionTriggerRef = useRef<HTMLButtonElement>(null)
  const actionTriggerRef = useRef<HTMLButtonElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<FloatingPlacement | null>(null)

  // `fixed` posicionado por medição, e não preso ao item por CSS: alinhado sempre à direita e ao
  // topo do item, o submenu era cortado pela borda da tela — e sem rolagem os últimos itens ficavam
  // inalcançáveis. Roda antes da pintura, então não pisca.
  useLayoutEffect(() => {
    if (!submenu) {
      setPlacement(null)
      return
    }
    const trigger = submenu === 'question' ? questionTriggerRef.current : actionTriggerRef.current
    const panel = submenuRef.current
    if (!trigger || !panel) return
    const anchor = trigger.getBoundingClientRect()
    setPlacement(
      placeFloatingPanel({
        anchor: { left: anchor.left, top: anchor.top, right: anchor.right, bottom: anchor.bottom },
        panel: { width: panel.offsetWidth, height: panel.scrollHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        prefer: 'side',
      }),
    )
  }, [submenu])

  const submenuStyle = {
    position: 'fixed' as const,
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    maxHeight: placement?.maxHeight,
    overflowY: 'auto' as const,
    // Até a medição terminar o painel existe mas não aparece — senão ele pisca um quadro na
    // posição errada, que é justamente o salto que esta correção remove.
    visibility: placement ? ('visible' as const) : ('hidden' as const),
  }

  function select(spec: NewNodeSpec) {
    onSelect(spec)
    setSubmenu(null)
  }

  return (
    <>
      <div className="relative">
        <button
          ref={questionTriggerRef}
          data-cv-tooltip={labels.palette.question} aria-label={labels.palette.question}
          onMouseEnter={() => setSubmenu('question')}
          onClick={() => setSubmenu(submenu === 'question' ? null : 'question')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <span className="flex items-center gap-2">
            <MessageCircleQuestion size={15} className="text-blue-500" /> {labels.palette.question}
          </span>
          <ChevronRight size={13} className="text-gray-400" />
        </button>
        {submenu === 'question' && (
          <div
            ref={submenuRef}
            style={submenuStyle}
            className="z-50 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
          >
            {QUESTION_TYPES.map((qt) => (
              <button
                data-cv-tooltip={labels.questionTypeLabels[qt]} aria-label={labels.questionTypeLabels[qt]}
                key={qt}
                onClick={() => select({ kind: 'question', questionType: qt })}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {labels.questionTypeLabels[qt]}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        data-cv-tooltip={labels.palette.decision} aria-label={labels.palette.decision}
        onMouseEnter={() => setSubmenu(null)}
        onClick={() => select({ kind: 'decision' })}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <GitBranch size={15} className="text-purple-500" /> {labels.palette.decision}
      </button>

      <button
        onMouseEnter={() => setSubmenu(null)}
        onClick={() => select({ kind: 'condition' })}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        data-cv-tooltip={labels.palette.conditionHint} aria-label={labels.palette.conditionHint}
      >
        <Diamond size={15} className="text-cyan-500" /> {labels.palette.condition}
      </button>

      <div className="relative">
        <button
          ref={actionTriggerRef}
          data-cv-tooltip={labels.palette.action} aria-label={labels.palette.action}
          onMouseEnter={() => setSubmenu('action')}
          onClick={() => setSubmenu(submenu === 'action' ? null : 'action')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <span className="flex items-center gap-2">
            <Zap size={15} className="text-orange-500" /> {labels.palette.action}
          </span>
          <ChevronRight size={13} className="text-gray-400" />
        </button>
        {submenu === 'action' && (
          <div
            ref={submenuRef}
            style={submenuStyle}
            className="z-50 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
          >
            {resolvedActionOptions.map((option) => (
              <button
                data-cv-tooltip={option.label} aria-label={option.label}
                key={option.actionKind}
                onClick={() => select({ kind: 'action', actionKind: option.actionKind })}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function FlowPalette({ onAdd, labels: labelsOverride, actionOptions }: FlowPaletteProps) {
  const labels = { ...DEFAULT_FLOW_EDITOR_LABELS, ...labelsOverride }
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function select(spec: NewNodeSpec) {
    onAdd(spec)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        data-cv-tooltip={labels.palette.title} aria-label={labels.palette.title}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <Plus size={14} /> {labels.palette.title}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50 py-1">
          <FlowPaletteMenu
            onSelect={select}
            labels={labels}
            {...(actionOptions ? { actionOptions } : {})}
          />
        </div>
      )}
    </div>
  )
}
