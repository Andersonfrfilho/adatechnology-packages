// Editor de fluxograma (T7.2) — subpath dedicado para que importar
// '@adatechnology/conversations-ui' sem '/flows' não puxe @xyflow/react ao bundle do host.
export { FlowNodeCard, flowNodeTypes, nodeLabel } from './FlowNodeCard'
export { FlowMapNode, flowMapNodeTypes } from './FlowMapNode'
export { FlowMapCanvas } from './FlowMapCanvas'
export { FlowGroupFrame, flowGroupFrameNodeTypes } from './FlowGroupFrame'
export { FlowGroupHeader, flowGroupHeaderNodeTypes } from './FlowGroupHeader'
export { FlowPortalNode, flowPortalNodeTypes } from './FlowPortalNode'
export { FlowPalette } from './FlowPalette'
export { FlowNodePanel } from './FlowNodePanel'
export { FlowWhatsAppPreview } from './FlowWhatsAppPreview'

export { DEFAULT_FLOW_EDITOR_LABELS, mergeFlowEditorLabels } from './labels'

export {
  CONDITION_OPERATORS,
  BUILT_IN_ACTION_KINDS,
  NODE_CARD_WIDTH,
  WHATSAPP_LIMITS,
  CROSS_FLOW_PREFIX,
  isCrossFlowTarget,
  crossFlowKey,
  estimateNodeHeight,
  rendersAsButtons,
  targetsOf,
  validateGraph,
  computeAutoLayout,
  crossFlowTargetsOf,
  computeFlowMapLayout,
  findCollectionChains,
  slugifyNodeId,
} from './flowGraph'

export type {
  FlowNodeType,
  FlowQuestionType,
  FlowActionKind,
  FlowConditionOperator,
  FlowNodeNext,
  FlowNodeData,
  FlowGraphData,
  GraphIssue,
  CollectionChain,
} from './flowGraph'

export type { FlowEditorLabels } from './labels'
export type { FlowNodeCardData } from './FlowNodeCard'
export type { FlowMapNodeData } from './FlowMapNode'
export type { FlowMapCanvasProps } from './FlowMapCanvas'
export type { FlowGroupFrameData } from './FlowGroupFrame'
export type { FlowGroupHeaderData } from './FlowGroupHeader'
export type { FlowPortalNodeData } from './FlowPortalNode'
export type { FlowPaletteProps, FlowPaletteActionOption, NewNodeSpec } from './FlowPalette'
export type { FlowNodePanelProps } from './FlowNodePanel'
export type { FlowWhatsAppPreviewProps } from './FlowWhatsAppPreview'

/**
 * Operações do EDITOR de fluxo, puras. Vinham soltas dentro da página de 973 linhas do
 * financiamento; são a base do `FlowsWorkspace` (ADR 0002) e a parte que carrega o risco de perder
 * trabalho de quem edita.
 */
/**
 * A TELA INTEIRA (ADR 0002). É o que um produto deve consumir — as peças acima existem para quem
 * tenha layout radicalmente diferente, e forkar a tela é o que fez os produtos divergirem antes.
 */
export { FlowsWorkspace } from './FlowsWorkspace'
export type { FlowsWorkspaceProps } from './FlowsWorkspace'
export { FlowEditorCanvas } from './FlowEditorCanvas'
export type { FlowEditorCanvasProps } from './FlowEditorCanvas'
export { CreateFlowDialog, DeleteFlowDialog } from './FlowManagerDialogs'

/** Camada headless: o produto que quiser outro visual reusa o estado e desenha por conta. */
export { useFlowsEditor } from './useFlowsEditor'
export type { FlowsWorkspaceApi, FlowsEditor, FlowNodeRef, SaveState } from './useFlowsEditor'

export {
  buildFlowEdges,
  chainFrameBounds,
  chainFrameNodeId,
  computeMergedLayout,
  countLiveByNode,
  detachedNodeIds,
  newNodeFromSpec,
  portalNodeId,
  GROUP_HEADER_NODE_ID,
} from './flowCanvasModel'
export type { FlowEdgeKind, FlowEdgeSpec, FlowLivePosition, FlowNodePosition } from './flowCanvasModel'

export {
  applyConnection,
  isGraphDirty,
  mergedFlowKeysFrom,
  namespaceNodeId,
  parseNamespacedId,
  removeNodeAndCleanRefs,
  resolveConnection,
} from './flowEditorOps'
export type { ConnectionRequest, ResolvedConnection } from './flowEditorOps'
