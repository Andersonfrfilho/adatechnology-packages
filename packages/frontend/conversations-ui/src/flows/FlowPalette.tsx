import { useEffect, useRef, useState } from 'react'
import { Plus, MessageCircleQuestion, GitBranch, Zap, Diamond, ChevronRight } from 'lucide-react'
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
export function FlowPalette({ onAdd, labels: labelsOverride, actionOptions }: FlowPaletteProps) {
  const labels = { ...DEFAULT_FLOW_EDITOR_LABELS, ...labelsOverride }
  const resolvedActionOptions = actionOptions ?? [
    { actionKind: 'handoff', label: labels.actionKindLabels.handoff ?? 'Encaminhar para atendimento' },
  ]

  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<'question' | 'action' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function select(spec: NewNodeSpec) {
    onAdd(spec)
    setOpen(false)
    setSubmenu(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <Plus size={14} /> {labels.palette.title}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50 py-1">
          <div className="relative">
            <button
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
              <div className="absolute left-full top-0 ml-1 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                {QUESTION_TYPES.map((qt) => (
                  <button
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
            title={labels.palette.conditionHint}
          >
            <Diamond size={15} className="text-cyan-500" /> {labels.palette.condition}
          </button>

          <div className="relative">
            <button
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
              <div className="absolute left-full top-0 ml-1 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                {resolvedActionOptions.map((option) => (
                  <button
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
        </div>
      )}
    </div>
  )
}
