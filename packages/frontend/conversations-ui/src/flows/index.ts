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
