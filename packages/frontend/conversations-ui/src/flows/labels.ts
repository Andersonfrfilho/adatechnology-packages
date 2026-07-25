import type { FlowConditionOperator, FlowNodeType, FlowQuestionType } from './flowGraph'

export interface FlowEditorLabels {
  legend: Record<FlowNodeType, string>
  startNodeTooltip: string
  liveCountTooltip: (count: number) => string
  edgeFallbackLabel: string
  // Rótulo por `actionKind` — o host estende esse mapa para registrar seus próprios kinds
  // (ex.: 'trigger_simulation') em vez do pacote assumir algum como padrão.
  actionKindLabels: Record<string, string>
  conditionOperatorLabels: Record<FlowConditionOperator, string>
  questionTypeLabels: Record<FlowQuestionType, string>
  nodePanel: {
    title: string
    contextKey: string
    questionType: string
    question: string
    options: string
    addOption: string
    optionId: string
    optionLabel: string
    next: string
    nextHint: string
    nextRowLabel: string
    otherFlowsGroup: string
    nextByAnswer: (id: string) => string
    nextDefault: string
    save: string
    cancel: string
    fixedLogicNotice: string
    actionNotice: string
    preview: string
    previewPlaceholder: string
    previewEmptyBody: string
    previewEmptyOption: string
    previewListButton: string
    previewModeButtons: string
    previewModeList: string
    delete: string
    deleteConfirm: string
    directMessage: string
    fallbackMessage: string
    conditionNotice: string
    conditionVariable: string
    conditionOperator: string
    conditionValue: string
    conditionTrue: string
    conditionFalse: string
    conditionVariableMissing: string
  }
  palette: {
    title: string
    question: string
    decision: string
    condition: string
    conditionHint: string
    action: string
  }
  flowMap: {
    nodeCount: (count: number) => string
    openFlow: string
  }
  flowGroup: {
    focus: string
    close: string
  }
  crossFlowPortal: {
    tooltip: string
    goesTo: (label: string) => string
  }
}

// Paridade de texto com financiamento-imobiliario-bot/apps/web/src/locales/modules/flows.ts —
// mesmo padrão de `labels` (partial override sobre defaults pt-BR) já usado em ./settings/*.
export const DEFAULT_FLOW_EDITOR_LABELS: FlowEditorLabels = {
  legend: {
    question: 'Pergunta',
    entrada_choice: 'Escolha calculada',
    action: 'Ação (simulação/atendimento)',
    menu: 'Menu',
    condition: 'Condição',
  },
  startNodeTooltip: 'Início do fluxo',
  liveCountTooltip: (count) => `${count} conversa(s) ativa(s) aqui agora`,
  edgeFallbackLabel: 'outro',
  actionKindLabels: {
    handoff: 'Encaminhar para atendimento',
    rate_limited_handoff: 'Encaminhar (limite de simulações atingido)',
    send_product_list: 'Enviar catálogo de produtos',
  },
  conditionOperatorLabels: {
    '>': 'maior que',
    '>=': 'maior ou igual a',
    '<': 'menor que',
    '<=': 'menor ou igual a',
    '==': 'igual a',
    '!=': 'diferente de',
    contains: 'contém',
  },
  questionTypeLabels: {
    text: 'Texto livre',
    money: 'Valor em R$',
    date: 'Data',
    int: 'Número inteiro',
    cpf: 'CPF',
    choice: 'Escolha (botões/lista)',
  },
  nodePanel: {
    title: 'Editar nó',
    contextKey: 'Chave (contexto)',
    questionType: 'Tipo de resposta',
    question: 'Texto da pergunta',
    options: 'Opções (choice)',
    addOption: 'Adicionar opção',
    optionId: 'Valor',
    optionLabel: 'Texto exibido',
    next: 'Próximo nó',
    nextHint: 'Também é possível arrastar um fio no canvas para conectar.',
    nextRowLabel: 'Próximo',
    otherFlowsGroup: 'Outros fluxos (salto)',
    nextByAnswer: (id) => `Se responder "${id}" →`,
    nextDefault: 'Caso contrário →',
    save: 'Salvar alterações',
    cancel: 'Cancelar',
    fixedLogicNotice:
      'Este nó tem lógica fixa (validações/cálculos do sistema) — só o texto e o destino são editáveis.',
    actionNotice: 'Nó de ação — dispara a ação registrada ou encaminha para atendimento humano.',
    preview: 'Como o cliente vê no WhatsApp',
    previewPlaceholder: 'Pré-visualização…',
    previewEmptyBody: '(escreva o texto da mensagem)',
    previewEmptyOption: '(sem texto)',
    previewListButton: 'Ver opções',
    previewModeButtons: 'Enviado como botões (até 3 opções)',
    previewModeList: 'Enviado como lista (4+ opções)',
    delete: 'Excluir nó',
    deleteConfirm: 'Excluir este nó? Ligações que apontam para ele ficarão quebradas.',
    directMessage: 'Mensagem (opcional)',
    fallbackMessage: 'Mensagem de fallback (quando o catálogo não está disponível)',
    conditionNotice: 'Nó de condição — não pergunta nada ao cliente, só decide automaticamente entre Verdadeiro/Falso.',
    conditionVariable: 'Variável (chave já coletada por uma pergunta anterior)',
    conditionOperator: 'Operador',
    conditionValue: 'Valor de comparação',
    conditionTrue: 'Se verdadeiro →',
    conditionFalse: 'Se falso →',
    conditionVariableMissing: 'Se a variável ainda não foi coletada →',
  },
  palette: {
    title: 'Adicionar ao fluxo',
    question: 'Pergunta',
    decision: 'Decisão',
    condition: 'Condição',
    conditionHint: 'Compara uma variável já coletada e segue automaticamente, sem perguntar nada',
    action: 'Ação',
  },
  flowMap: {
    nodeCount: (count) => `${count} nó(s)`,
    openFlow: 'Abrir fluxo',
  },
  flowGroup: {
    focus: 'Focar neste fluxo',
    close: 'Fechar',
  },
  crossFlowPortal: {
    tooltip: 'Clique para abrir esse fluxo aqui do lado, ligado ao ponto de onde ele é chamado',
    goesTo: (label) => `↪ Vai para: ${label}`,
  },
}

export function mergeFlowEditorLabels(override?: Partial<FlowEditorLabels>): FlowEditorLabels {
  if (!override) return DEFAULT_FLOW_EDITOR_LABELS
  return {
    ...DEFAULT_FLOW_EDITOR_LABELS,
    ...override,
    legend: { ...DEFAULT_FLOW_EDITOR_LABELS.legend, ...override.legend },
    actionKindLabels: { ...DEFAULT_FLOW_EDITOR_LABELS.actionKindLabels, ...override.actionKindLabels },
    conditionOperatorLabels: {
      ...DEFAULT_FLOW_EDITOR_LABELS.conditionOperatorLabels,
      ...override.conditionOperatorLabels,
    },
    questionTypeLabels: { ...DEFAULT_FLOW_EDITOR_LABELS.questionTypeLabels, ...override.questionTypeLabels },
    nodePanel: { ...DEFAULT_FLOW_EDITOR_LABELS.nodePanel, ...override.nodePanel },
    palette: { ...DEFAULT_FLOW_EDITOR_LABELS.palette, ...override.palette },
    flowMap: { ...DEFAULT_FLOW_EDITOR_LABELS.flowMap, ...override.flowMap },
    flowGroup: { ...DEFAULT_FLOW_EDITOR_LABELS.flowGroup, ...override.flowGroup },
    crossFlowPortal: { ...DEFAULT_FLOW_EDITOR_LABELS.crossFlowPortal, ...override.crossFlowPortal },
  }
}
