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
export { FlowsWorkspace } from './FlowsWorkspace'

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

export type { FlowEditorLabels, FlowValidationLabels } from './labels'
export type { FlowsWorkspaceProps, FlowsWorkspaceApi, FlowLivePosition, CreateFlowInput } from './FlowsWorkspace'
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

/**
 * Modelo do canvas: posições, arestas, contagem ao vivo e o nó novo da paleta.
 *
 * Exportado porque é consumido pelo `FlowsWorkspace` e tem teste próprio — as decisões daqui não dão
 * erro quando erram, dão conversa parada e card fora da tela.
 */
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
// `FlowLivePosition` já sai pelo `FlowsWorkspace`, que é onde o produto a encontra ao implementar a
// api — exportar de novo aqui daria dois caminhos para o mesmo tipo.
export type { FlowEdgeKind, FlowEdgeSpec, FlowNodePosition } from './flowCanvasModel'
