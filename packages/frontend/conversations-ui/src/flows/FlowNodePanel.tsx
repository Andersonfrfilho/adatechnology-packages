import { useState } from 'react'
import { Plus, Trash2, Save, X, AlertTriangle, AlertCircle } from 'lucide-react'
import { FlowWhatsAppPreview } from './FlowWhatsAppPreview'
import { nodeLabel } from './FlowNodeCard'
import { CROSS_FLOW_PREFIX, CONDITION_OPERATORS } from './flowGraph'
import { DEFAULT_FLOW_EDITOR_LABELS, type FlowEditorLabels } from './labels'
import type { FlowGraphData, FlowNodeData, GraphIssue } from './flowGraph'

const SELECT_CLASSNAME =
  'border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
const INPUT_CLASSNAME =
  'border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'

function truncateLabel(value: string, max = 60): string {
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function WhatsAppTextField({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  labels,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options?: [string, string][]
  placeholder?: string
  labels: FlowEditorLabels
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
        <textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={`w-full mt-1 ${INPUT_CLASSNAME}`}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.preview}</label>
        <div className="mt-1">
          <FlowWhatsAppPreview body={value} options={options} labels={labels.nodePanel} />
        </div>
      </div>
    </div>
  )
}

function IssueRow({ issue }: { issue: GraphIssue }) {
  const Icon = issue.severity === 'error' ? AlertCircle : AlertTriangle
  const color = issue.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
  return (
    <div className={`flex items-start gap-1.5 text-xs ${color}`}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span>{issue.message}</span>
    </div>
  )
}

export interface FlowNodePanelProps {
  graph: FlowGraphData
  node: FlowNodeData
  issues: GraphIssue[]
  otherFlows: { key: string; label: string }[]
  onClose: () => void
  onChange: (updated: FlowNodeData) => void
  onDelete: (nodeId: string) => void
  labels?: Partial<FlowEditorLabels>
}

// Paridade com financiamento-imobiliario-bot/apps/web/src/components/flows/FlowNodePanel.tsx —
// painel lateral de edição de um nó do fluxo (pergunta, decisão, ação ou condição).
export function FlowNodePanel({
  graph,
  node,
  issues,
  otherFlows,
  onClose,
  onChange,
  onDelete,
  labels: labelsOverride,
}: FlowNodePanelProps) {
  const labels = { ...DEFAULT_FLOW_EDITOR_LABELS, ...labelsOverride }
  const [draft, setDraft] = useState<FlowNodeData>(node)
  const otherNodeIds = Object.keys(graph.nodes).filter((id) => id !== node.id)
  const isFixedLogic = draft.type === 'entrada_choice'
  const isAction = draft.type === 'action'
  const isCondition = draft.type === 'condition'
  const isStart = graph.startNodeId === node.id
  const nodeIssues = issues.filter((i) => i.nodeId === node.id)
  // Chaves já usadas por perguntas deste fluxo — sugestão pro campo de variável da condição,
  // sem travar em texto livre (a variável pode ter vindo de outro fluxo ou de um cálculo derivado).
  const knownContextKeys = [...new Set(Object.values(graph.nodes).map((n) => n.contextKey).filter((key): key is string => !!key))]
  const conditionAnswerIds = isCondition ? ['true', 'false'] : (draft.options ?? []).map(([id]) => id)

  function updateNextString(value: string) {
    setDraft((prev) => ({ ...prev, next: value }))
  }

  function updateNextByAnswer(answerId: string, value: string) {
    setDraft((prev) => {
      const current = typeof prev.next === 'object' && prev.next ? prev.next : { byAnswer: {}, default: otherNodeIds[0] ?? '' }
      return { ...prev, next: { ...current, byAnswer: { ...current.byAnswer, [answerId]: value } } }
    })
  }

  function updateNextDefault(value: string) {
    setDraft((prev) => {
      const current = typeof prev.next === 'object' && prev.next ? prev.next : { byAnswer: {}, default: value }
      return { ...prev, next: { ...current, default: value } }
    })
  }

  function updateOption(index: number, field: 0 | 1, value: string) {
    setDraft((prev) => {
      const opts = [...(prev.options ?? [])]
      const opt: [string, string] = [...opts[index]!] as [string, string]
      opt[field] = value
      opts[index] = opt
      return { ...prev, options: opts }
    })
  }

  function addOption() {
    setDraft((prev) => ({ ...prev, options: [...(prev.options ?? []), [String((prev.options?.length ?? 0) + 1), 'Nova opção']] }))
  }

  function removeOption(index: number) {
    setDraft((prev) => ({ ...prev, options: (prev.options ?? []).filter((_, i) => i !== index) }))
  }

  function nextNodeOptions() {
    return (
      <>
        {otherNodeIds.map((id) => (
          <option key={id} value={id}>{truncateLabel(nodeLabel(graph.nodes[id], labels))}</option>
        ))}
        {otherFlows.length > 0 && (
          <optgroup label={labels.nodePanel.otherFlowsGroup}>
            {otherFlows.map((flow) => (
              <option key={flow.key} value={`${CROSS_FLOW_PREFIX}${flow.key}`}>{flow.label}</option>
            ))}
          </optgroup>
        )}
      </>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.nodePanel.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {nodeIssues.length > 0 && (
          <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2.5 space-y-1.5">
            {nodeIssues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
          </div>
        )}

        {isFixedLogic && (
          <p className="text-xs text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2">
            {labels.nodePanel.fixedLogicNotice}
          </p>
        )}
        {isAction && (
          <p className="text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 rounded-lg p-2">
            {labels.nodePanel.actionNotice}
          </p>
        )}
        {isCondition && (
          <p className="text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-2">
            {labels.nodePanel.conditionNotice}
          </p>
        )}

        {draft.contextKey && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.contextKey}</label>
            <input value={draft.contextKey} disabled className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-500" />
          </div>
        )}

        {!isFixedLogic && !isAction && !isCondition && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.questionType}</label>
            <select
              value={draft.questionType ?? 'text'}
              onChange={(e) => setDraft((prev) => ({ ...prev, questionType: e.target.value as FlowNodeData['questionType'] }))}
              className={`w-full mt-1 ${SELECT_CLASSNAME}`}
            >
              {Object.entries(labels.questionTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {!isFixedLogic && !isAction && !isCondition && (
          <WhatsAppTextField
            label={labels.nodePanel.question}
            value={draft.question ?? ''}
            options={draft.questionType === 'choice' ? draft.options : undefined}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, question: value }))}
            labels={labels}
          />
        )}

        {isCondition && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.conditionVariable}</label>
              <input
                value={draft.conditionContextKey ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, conditionContextKey: e.target.value }))}
                list="condition-context-keys"
                className={`w-full mt-1 ${INPUT_CLASSNAME}`}
              />
              <datalist id="condition-context-keys">
                {knownContextKeys.map((key) => <option key={key} value={key} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.conditionOperator}</label>
              <select
                value={draft.conditionOperator ?? '>'}
                onChange={(e) => setDraft((prev) => ({ ...prev, conditionOperator: e.target.value as FlowNodeData['conditionOperator'] }))}
                className={`w-full mt-1 ${SELECT_CLASSNAME}`}
              >
                {CONDITION_OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>{labels.conditionOperatorLabels[operator] ?? operator}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.conditionValue}</label>
              <input
                value={draft.conditionValue ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, conditionValue: e.target.value }))}
                className={`w-full mt-1 ${INPUT_CLASSNAME}`}
              />
            </div>
          </div>
        )}

        {isAction && draft.actionKind === 'send_product_list' && (
          <WhatsAppTextField
            label={labels.nodePanel.fallbackMessage}
            value={draft.fallbackMessage ?? ''}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, fallbackMessage: value }))}
            placeholder="(usa a mensagem padrão de fallback se vazio)"
            labels={labels}
          />
        )}

        {isAction && draft.actionKind !== 'send_product_list' && (
          <WhatsAppTextField
            label={labels.nodePanel.directMessage}
            value={draft.directMessage ?? ''}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, directMessage: value }))}
            placeholder="(usa a mensagem padrão de encaminhamento se vazio)"
            labels={labels}
          />
        )}

        {(draft.questionType === 'choice' || draft.type === 'menu') && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.options}</label>
              <button onClick={addOption} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> {labels.nodePanel.addOption}
              </button>
            </div>
            <div className="space-y-2">
              {(draft.options ?? []).map(([id, label], i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={id} onChange={(e) => updateOption(i, 0, e.target.value)} placeholder={labels.nodePanel.optionId}
                    className={`w-16 ${INPUT_CLASSNAME}`} />
                  <input value={label} onChange={(e) => updateOption(i, 1, e.target.value)} placeholder={labels.nodePanel.optionLabel}
                    className={`flex-1 ${INPUT_CLASSNAME}`} />
                  <button onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isAction && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.nodePanel.next}</label>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">{labels.nodePanel.nextHint}</p>
            {typeof draft.next !== 'object' && !isCondition ? (
              <select value={typeof draft.next === 'string' ? draft.next : ''} onChange={(e) => updateNextString(e.target.value)}
                className={`w-full mt-1 ${SELECT_CLASSNAME}`}>
                <option value="">—</option>
                {nextNodeOptions()}
              </select>
            ) : (
              <div className="space-y-2 mt-1">
                {conditionAnswerIds.map((id) => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-32 shrink-0">
                      {isCondition ? (id === 'true' ? labels.nodePanel.conditionTrue : labels.nodePanel.conditionFalse) : labels.nodePanel.nextByAnswer(id)}
                    </span>
                    <select value={draft.next && typeof draft.next === 'object' ? draft.next.byAnswer[id] ?? '' : ''} onChange={(e) => updateNextByAnswer(id, e.target.value)}
                      className={`flex-1 ${SELECT_CLASSNAME}`}>
                      <option value="">—</option>
                      {nextNodeOptions()}
                    </select>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-32 shrink-0">
                    {isCondition ? labels.nodePanel.conditionVariableMissing : labels.nodePanel.nextDefault}
                  </span>
                  <select value={draft.next && typeof draft.next === 'object' ? draft.next.default : ''} onChange={(e) => updateNextDefault(e.target.value)}
                    className={`flex-1 ${SELECT_CLASSNAME}`}>
                    <option value="">—</option>
                    {nextNodeOptions()}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        <button onClick={() => onChange(draft)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Save size={14} /> {labels.nodePanel.save}
        </button>
        {!isStart && (
          <button
            onClick={() => { if (window.confirm(labels.nodePanel.deleteConfirm)) onDelete(node.id) }}
            title={labels.nodePanel.delete}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:underline">
          {labels.nodePanel.cancel}
        </button>
      </div>
    </div>
  )
}
