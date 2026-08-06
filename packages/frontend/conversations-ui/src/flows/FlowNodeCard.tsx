import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  MessageCircleQuestion,
  GitBranch,
  Zap,
  ListTree,
  Diamond,
  AlertTriangle,
  AlertCircle,
  Headset,
  Clock3,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import type { FlowEditorLabels } from './labels'
import type { FlowNodeData, GraphIssue } from './flowGraph'

const NODE_TYPE_COLOR: Record<FlowNodeData['type'], string> = {
  question: 'border-blue-300 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800',
  entrada_choice: 'border-purple-300 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-800',
  action: 'border-orange-300 bg-orange-50 dark:bg-orange-950/40 dark:border-orange-800',
  menu: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800',
  condition: 'border-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 dark:border-cyan-800',
}

const NODE_TYPE_ICON: Record<FlowNodeData['type'], LucideIcon> = {
  question: MessageCircleQuestion,
  entrada_choice: ListTree,
  action: Zap,
  menu: GitBranch,
  condition: Diamond,
}

// Ícone por função da ação — o host estende via `actionKindIcons` (FlowNodeCardData) para
// registrar ícones dos próprios `actionKind`s sem o pacote assumir nenhum caso de negócio.
const DEFAULT_ACTION_KIND_ICON: Record<string, LucideIcon> = {
  handoff: Headset,
  rate_limited_handoff: Clock3,
  send_product_list: ShoppingBag,
}

// Rótulo amigável para exibir em cartões/selects — nunca a chave interna crua (ex.: "action_handoff"),
// que só faz sentido para quem escreveu o interpretador do fluxo, não para quem está editando.
export function nodeLabel(node: FlowNodeData | undefined, labels: FlowEditorLabels): string {
  if (!node) return '—'
  if (node.type === 'action') {
    const actionKindLabel = node.actionKind ? labels.actionKindLabels[node.actionKind] : undefined
    // Sempre retorna string: um actionKind futuro sem label mapeado cai no próprio valor bruto
    // em vez de undefined (que quebraria qualquer .length/truncate rio abaixo).
    return node.directMessage || node.fallbackMessage || actionKindLabel || node.actionKind || node.id
  }
  if (node.type === 'condition') {
    if (!node.conditionContextKey || !node.conditionOperator || !node.conditionValue) return node.id
    const operatorLabel = labels.conditionOperatorLabels[node.conditionOperator] ?? node.conditionOperator
    return `${node.conditionContextKey} ${operatorLabel} ${node.conditionValue}`
  }
  return node.question || node.contextKey || node.id
}

export type FlowNodeCardData = {
  node: FlowNodeData
  liveCount: number
  isStart: boolean
  isSelected: boolean
  /** Nenhum caminho chega até este nó — o contorno tracejado cobra a ligação que falta. */
  isDetached?: boolean
  issues: GraphIssue[]
  labels: FlowEditorLabels
  actionKindIcons?: Record<string, LucideIcon>
  onSelect: (id: string) => void
}

// Uma linha por saída: nós de escolha (question+choice ou menu) ganham UMA linha por opção mais
// uma linha "caso contrário" — cada uma com seu próprio handle, arrastável pra uma conexão
// condicional distinta. Nós lineares (pergunta simples) têm uma única linha "Próximo". Ações são
// terminais (o motor do host nunca continua a partir de 'next' de uma ação) — sem linha.
function sourceRows(node: FlowNodeData, labels: FlowEditorLabels): { id: string; label: string; isDefault: boolean }[] {
  if (node.type === 'action') return []
  if (node.type === 'condition') {
    return [
      { id: 'true', label: labels.nodePanel.conditionTrue, isDefault: false },
      { id: 'false', label: labels.nodePanel.conditionFalse, isDefault: false },
    ]
  }
  const isChoice = node.type === 'menu' || node.questionType === 'choice'
  if (!isChoice) return [{ id: 'next', label: labels.nodePanel.nextRowLabel, isDefault: false }]
  const options = node.options ?? []
  return [
    ...options.map(([id, label]) => ({ id, label, isDefault: false })),
    { id: '__default', label: labels.edgeFallbackLabel, isDefault: true },
  ]
}

// Uma linha de saída, com seu próprio handle ancorado na borda direita da própria linha (não
// mais distribuído na borda inferior do card) — assim dá pra ler "opção → destino" sem seguir
// o fio até o label da ligação, que é justamente o que confundia num fluxo com muitos ramos.
function SourceRow({ label, isDefault, handleId }: { label: string; isDefault: boolean; handleId: string }) {
  return (
    <div className="relative flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-900/40 px-2 py-1 pr-3">
      <span
        className={`text-xs truncate flex-1 ${isDefault ? 'italic text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}
      >
        {label}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id={handleId}
        style={{ position: 'absolute', right: -7, top: '50%', transform: 'translateY(-50%)' }}
        className={isDefault ? '!bg-gray-400 dark:!bg-gray-500' : '!bg-purple-500'}
      />
    </div>
  )
}

export function FlowNodeCard({ data }: NodeProps) {
  const { node, liveCount, isStart, isSelected, isDetached, issues, labels, actionKindIcons, onSelect } =
    data as unknown as FlowNodeCardData
  const label = nodeLabel(node, labels)
  const iconMap = { ...DEFAULT_ACTION_KIND_ICON, ...actionKindIcons }
  const Icon =
    node.type === 'action' && node.actionKind
      ? (iconMap[node.actionKind] ?? NODE_TYPE_ICON[node.type])
      : NODE_TYPE_ICON[node.type]
  const rows = sourceRows(node, labels)
  const hasError = issues.some((i) => i.severity === 'error')
  const hasWarning = !hasError && issues.some((i) => i.severity === 'warning')

  return (
    <div
      title={isDetached ? labels.detachedNodeTooltip : label}
      className={`relative rounded-lg border-2 px-3 py-2 w-60 cursor-pointer shadow-sm hover:shadow-md transition-shadow ${NODE_TYPE_COLOR[node.type]} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''} ${isDetached ? 'border-dashed animate-pulse' : ''}`}
      onClick={() => onSelect(node.id)}
    >
      <Handle type="target" position={Position.Top} id="target" className="!bg-gray-400 dark:!bg-gray-500" />

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 text-xs">
          <Icon size={12} strokeWidth={2.5} />
          {isStart && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title={labels.startNodeTooltip} />}
          {labels.legend[node.type]}
        </span>
        <div className="flex items-center gap-1">
          {hasError && <AlertCircle size={13} className="text-red-600 dark:text-red-400" />}
          {hasWarning && <AlertTriangle size={13} className="text-amber-500 dark:text-amber-400" />}
          {liveCount > 0 && (
            <span
              title={labels.liveCountTooltip(liveCount)}
              className="font-bold bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-xs"
            >
              {liveCount}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 line-clamp-3">{label}</p>

      {rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {rows.map((row) => (
            <SourceRow key={row.id} label={row.label} isDefault={row.isDefault} handleId={row.id} />
          ))}
        </div>
      )}
    </div>
  )
}

export const flowNodeTypes = { flowNode: FlowNodeCard }
