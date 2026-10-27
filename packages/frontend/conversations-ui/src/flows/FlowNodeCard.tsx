import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  MessageCircleQuestion,
  Plus,
  GitBranch,
  Zap,
  ListTree,
  Diamond,
  AlertTriangle,
  AlertCircle,
  Headset,
  Clock3,
  ShoppingBag,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import type { FlowEditorLabels } from './labels'
import { PASS_THROUGH_ACTION_KINDS, type FlowNodeData, type GraphIssue } from './flowGraph'

/**
 * Diâmetro dos pontos de ligação.
 *
 * O padrão do react-flow tem ~6px, e mirar nele com o mouse é tarefa de precisão — some com a
 * borda do card e não se lê como "puxe daqui". Vale para o alvo (topo) e para cada saída.
 */
const HANDLE_SIZE_PX = 14

export const NODE_TYPE_COLOR: Record<FlowNodeData['type'], string> = {
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
  // Apelido dado no editor manda sobre qualquer texto derivado: dois nós de mesma ação ficam
  // idênticos no card sem ele, e é exatamente para desempatá-los que o campo existe.
  if (node.label) return node.label
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
  /**
   * Nó sem nenhuma ligação de entrada — o bot nunca chega nele. Contorno tracejado e pulso: sem
   * isso, desconectar um fio ou criar um card solto passa despercebido até o fluxo quebrar em
   * produção.
   */
  isDetached?: boolean
  issues: GraphIssue[]
  labels: FlowEditorLabels
  actionKindIcons?: Record<string, LucideIcon>
  onSelect: (id: string) => void
  /**
   * Criar o próximo nó já ligado nesta saída. Capacidade por ausência: sem o callback, o "+" não
   * aparece — puxar o fio à mão continua funcionando igual.
   */
  onQuickAdd?: ((params: { nodeId: string; handle: string; anchor: { x: number; y: number } }) => void) | undefined
}

// Uma linha por saída: nós de escolha (question+choice ou menu) ganham UMA linha por opção mais
// uma linha "caso contrário" — cada uma com seu próprio handle, arrastável pra uma conexão
// condicional distinta. Nós lineares (pergunta simples) têm uma única linha "Próximo". Ações são
// terminais (o motor do host nunca continua a partir de 'next' de uma ação) — sem linha.
type SourceRowSpec = { id: string; label: string; isDefault: boolean; isSelfLoop: boolean }

/**
 * Quais saídas deste card voltam para ele mesmo.
 *
 * Sai do próprio nó porque é o único lugar que sabe: uma aresta de A para A não tem trajeto para
 * desenhar, então quem mostra o comportamento é a linha de saída, com um ícone de repetição.
 */
function selfLoopHandles(node: FlowNodeData): Set<string> {
  const loops = new Set<string>()
  if (typeof node.next === 'string') {
    if (node.next === node.id) loops.add('next')
    return loops
  }
  if (!node.next) return loops

  for (const [optionId, target] of Object.entries(node.next.byAnswer ?? {})) {
    if (target === node.id) loops.add(optionId)
  }
  if (node.next.default === node.id) loops.add('__default')

  return loops
}

function sourceRows(node: FlowNodeData, labels: FlowEditorLabels): SourceRowSpec[] {
  // Ação de passagem tem saída; ação terminal, não — ver `PASS_THROUGH_ACTION_KINDS`.
  if (node.type === 'action') {
    return node.actionKind && PASS_THROUGH_ACTION_KINDS.includes(node.actionKind)
      ? [{ id: 'next', label: labels.nodePanel.nextRowLabel, isDefault: false, isSelfLoop: false }]
      : []
  }

  const loops = selfLoopHandles(node)
  if (node.type === 'condition') {
    return [
      { id: 'true', label: labels.nodePanel.conditionTrue, isDefault: false, isSelfLoop: loops.has('true') },
      { id: 'false', label: labels.nodePanel.conditionFalse, isDefault: false, isSelfLoop: loops.has('false') },
    ]
  }
  const isChoice = node.type === 'menu' || node.questionType === 'choice'
  if (!isChoice)
    return [{ id: 'next', label: labels.nodePanel.nextRowLabel, isDefault: false, isSelfLoop: loops.has('next') }]
  const options = node.options ?? []
  return [
    ...options.map(([id, label]) => ({ id, label, isDefault: false, isSelfLoop: loops.has(id) })),
    { id: '__default', label: labels.edgeFallbackLabel, isDefault: true, isSelfLoop: loops.has('__default') },
  ]
}

// Uma linha de saída, com seu próprio handle ancorado na borda direita da própria linha (não
// mais distribuído na borda inferior do card) — assim dá pra ler "opção → destino" sem seguir
// o fio até o label da ligação, que é justamente o que confundia num fluxo com muitos ramos.
/**
 * Uma saída do card: o rótulo, o ponto de onde se puxa o fio e o "+" que cria o próximo nó já
 * ligado nele.
 *
 * Duas decisões que vieram de ver alguém usar:
 *
 * O "+" está **sempre visível**, esmaecido, e não aparece no hover. Aparecer no hover criava uma
 * corrida contra o mouse: o botão fica à direita da linha, então o ponteiro atravessava o vão
 * entre os dois, o hover caía e o botão sumia antes de ser alcançado.
 *
 * E a área que reage ao mouse **engloba o botão** (o `pr-9` do container), em vez de terminar na
 * borda da linha — sem isso o vão continuaria existindo para o realce.
 */
function SourceRow({
  label,
  isDefault,
  handleId,
  addLabel,
  isSelfLoop,
  selfLoopLabel,
  onQuickAdd,
}: {
  label: string
  isDefault: boolean
  handleId: string
  addLabel: string
  isSelfLoop: boolean
  selfLoopLabel: string
  onQuickAdd?: ((params: { handle: string; anchor: { x: number; y: number } }) => void) | undefined
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`relative ${onQuickAdd ? 'pr-9' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white/70 dark:bg-gray-900/40 px-2 py-1 pr-3">
        <span
          className={`text-xs truncate flex-1 ${isDefault ? 'italic text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}
        >
          {label}
        </span>
        {isSelfLoop && (
          <RotateCcw
            size={12}
            strokeWidth={2.5}
            data-cv-tooltip={selfLoopLabel}
            aria-label={selfLoopLabel}
            className="shrink-0 text-gray-400 dark:text-gray-500"
          />
        )}
        <Handle
          type="source"
          position={Position.Right}
          id={handleId}
          style={{
            position: 'absolute',
            right: -(HANDLE_SIZE_PX / 2 + 1),
            top: '50%',
            transform: 'translateY(-50%)',
            width: HANDLE_SIZE_PX,
            height: HANDLE_SIZE_PX,
          }}
          className={`!border-2 !border-white dark:!border-gray-800 ${isDefault ? '!bg-gray-400 dark:!bg-gray-500' : '!bg-purple-500'}`}
        />
      </div>
      {onQuickAdd && (
        <button
          type="button"
          data-cv-tooltip={addLabel}
          aria-label={addLabel}
          onClick={(event) => {
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            onQuickAdd({ handle: handleId, anchor: { x: rect.right, y: rect.top } })
          }}
          // Opacidade inline, e não classe utilitária: o realce é estado de interação deste
          // botão, e prende o valor ao componente em vez de depender do CSS gerado no build.
          style={{ opacity: hovered ? 1 : 0.35 }}
          className="nodrag absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300 bg-white text-blue-600 shadow-sm transition-opacity hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
        >
          <Plus size={12} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}

export function FlowNodeCard({ data }: NodeProps) {
  const { node, liveCount, isStart, isSelected, isDetached, issues, labels, actionKindIcons, onSelect, onQuickAdd } =
    data as unknown as FlowNodeCardData
  const label = nodeLabel(node, labels)
  const iconMap = { ...DEFAULT_ACTION_KIND_ICON, ...actionKindIcons }
  const Icon =
    node.type === 'action' && node.actionKind
      ? (iconMap[node.actionKind] ?? NODE_TYPE_ICON[node.type])
      : NODE_TYPE_ICON[node.type]
  const rows = sourceRows(node, labels)
  // Filtrado pelo nó, e não pelo fluxo: sem isto TODO card do fluxo acendia o alerta quando UM
  // deles tinha problema, e o ícone deixava de apontar qualquer coisa. Aviso sem alvo é ruído.
  const nodeIssues = issues.filter((issue) => issue.nodeId === node.id)
  const errors = nodeIssues.filter((issue) => issue.severity === 'error')
  const warnings = nodeIssues.filter((issue) => issue.severity === 'warning')
  const hasError = errors.length > 0
  const hasWarning = !hasError && warnings.length > 0
  // Separador em vez de quebra de linha: o balão não preserva `\n`. O ícone dizia que havia algo
  // errado sem dizer o quê, e corrigir passava por abrir o painel de cada card procurando.
  const issueTooltip = (hasError ? errors : warnings).map((issue) => issue.message).join(' · ')

  return (
    <div
      data-cv-tooltip={isDetached ? labels.detachedNodeTooltip : label}
      className={`relative rounded-lg border-2 px-3 py-2 w-60 cursor-pointer shadow-sm hover:shadow-md transition-shadow ${NODE_TYPE_COLOR[node.type]} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''} ${isDetached ? 'border-dashed !border-amber-400 animate-pulse' : ''}`}
      onClick={() => onSelect(node.id)}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        style={{ width: HANDLE_SIZE_PX, height: HANDLE_SIZE_PX }}
        className="!bg-gray-400 !border-2 !border-white dark:!bg-gray-500 dark:!border-gray-800"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 text-xs">
          <Icon size={12} strokeWidth={2.5} />
          {isStart && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" data-cv-tooltip={labels.startNodeTooltip} />}
          {labels.legend[node.type]}
        </span>
        <div className="flex items-center gap-1">
          {hasError && (
            <AlertCircle
              size={13}
              data-cv-tooltip={issueTooltip}
              aria-label={issueTooltip}
              className="text-red-600 dark:text-red-400"
            />
          )}
          {hasWarning && (
            <AlertTriangle
              size={13}
              data-cv-tooltip={issueTooltip}
              aria-label={issueTooltip}
              className="text-amber-500 dark:text-amber-400"
            />
          )}
          {liveCount > 0 && (
            <span
              data-cv-tooltip={labels.liveCountTooltip(liveCount)}
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
            <SourceRow
              key={row.id}
              label={row.label}
              isDefault={row.isDefault}
              handleId={row.id}
              addLabel={labels.quickAdd.fromHandle}
              isSelfLoop={row.isSelfLoop}
              selfLoopLabel={labels.legendPanel.selfLoop}
              {...(onQuickAdd
                ? { onQuickAdd: (params) => onQuickAdd({ nodeId: node.id, ...params }) }
                : {})}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const flowNodeTypes = { flowNode: FlowNodeCard }
