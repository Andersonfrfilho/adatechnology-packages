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
    media: string
    mediaUnavailable: string
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
    toggleToMap: string
    toggleToDetail: string
  }
  flowGroup: {
    focus: string
    close: string
  }
  crossFlowPortal: {
    tooltip: string
    goesTo: (label: string) => string
  }
  /** Card que ninguém aponta: o contorno tracejado precisa dizer por que está piscando. */
  detachedNodeTooltip: string
  collectionChain: {
    feeds: (actionLabel: string) => string
  }
  flowManager: {
    newFlow: string
    deleteFlow: string
    createTitle: string
    label: string
    key: string
    keyHint: string
    keyInvalid: string
    showInMenu: string
    menuOptionLabel: string
    create: string
    creating: string
    createError: string
    deleteConfirm: (label: string) => string
    deleteError: string
  }
  /**
   * Texto dos problemas do grafo. Mesma forma que `validateGraph` já aceita — o workspace repassa
   * este grupo direto para lá, em vez de o produto chamar a validação por fora.
   */
  validation: {
    title: string
    errors: (count: number) => string
    warnings: (count: number) => string
    noStart: string
    brokenRef: (from: string, to: string) => string
    choiceWithoutOptions: (id: string) => string
    duplicatedOptionId: (id: string, optionId: string) => string
    optionWithoutTarget: (id: string, optionLabel: string) => string
    tooManyOptions: (id: string, count: number) => string
    buttonTitleTooLong: (id: string, label: string) => string
    listTitleTooLong: (id: string, label: string) => string
    bodyTooLong: (id: string) => string
    unreachable: (id: string) => string
    deadEndQuestion: (id: string) => string
    conditionIncomplete: (id: string) => string
    conditionBranchMissing: (id: string, branch: string) => string
  }
  /** Moldura da tela inteira: título, estados de carga e as ações da barra de cima. */
  workspace: {
    title: string
    subtitle: string
    loading: string
    loadError: string
    saveGraph: string
    saving: string
    saveSuccess: string
    saveError: string
    organize: string
    organizeTooltip: string
    discardChanges: string
    discardTooltip: string
    discardConfirm: string
    unsavedChangesConfirm: string
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
    send_media: 'Enviar arquivos da biblioteca',
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
    media: 'Arquivos enviados neste ponto',
    mediaUnavailable: 'A biblioteca de arquivos não está disponível neste painel.',
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
    toggleToMap: 'Ver mapa',
    toggleToDetail: 'Ver fluxo',
  },
  flowGroup: {
    focus: 'Focar neste fluxo',
    close: 'Fechar',
  },
  crossFlowPortal: {
    tooltip: 'Clique para abrir esse fluxo aqui do lado, ligado ao ponto de onde ele é chamado',
    goesTo: (label) => `↪ Vai para: ${label}`,
  },
  detachedNodeTooltip: 'Nenhum caminho leva até aqui — falta ligar este card',
  collectionChain: {
    feeds: (actionLabel) => `Coleta para: ${actionLabel}`,
  },
  flowManager: {
    newFlow: 'Novo fluxo',
    deleteFlow: 'Excluir fluxo',
    createTitle: 'Criar fluxo',
    label: 'Nome',
    key: 'Identificador',
    keyHint: 'Letras minúsculas, números e _ — de 2 a 40 caracteres',
    keyInvalid: 'Use apenas letras minúsculas, números e _ (2 a 40 caracteres)',
    showInMenu: 'Oferecer este fluxo no menu principal',
    menuOptionLabel: 'Texto da opção no menu',
    create: 'Criar',
    creating: 'Criando…',
    createError: 'Não foi possível criar o fluxo',
    deleteConfirm: (label) => `Excluir o fluxo "${label}"? Esta ação não pode ser desfeita.`,
    deleteError: 'Não foi possível excluir o fluxo',
  },
  validation: {
    title: 'Validação',
    errors: (count) => `${count} erro(s)`,
    warnings: (count) => `${count} aviso(s)`,
    noStart: 'O fluxo não tem nó inicial',
    brokenRef: (from, to) => `"${from}" aponta para "${to}", que não existe`,
    choiceWithoutOptions: (id) => `"${id}" é uma escolha sem opções`,
    duplicatedOptionId: (id, optionId) => `"${id}" repete a opção "${optionId}"`,
    optionWithoutTarget: (id, optionLabel) => `A opção "${optionLabel}" de "${id}" não leva a nenhum nó`,
    tooManyOptions: (id, count) => `"${id}" tem ${count} opções — o WhatsApp aceita no máximo 10`,
    buttonTitleTooLong: (id, label) => `O botão "${label}" de "${id}" passa do limite do WhatsApp`,
    listTitleTooLong: (id, label) => `O item "${label}" de "${id}" passa do limite do WhatsApp`,
    bodyTooLong: (id) => `A mensagem de "${id}" passa do limite do WhatsApp`,
    unreachable: (id) => `Nenhum caminho chega até "${id}"`,
    deadEndQuestion: (id) => `"${id}" pergunta e não continua para nenhum nó`,
    conditionIncomplete: (id) => `A condição "${id}" está incompleta`,
    conditionBranchMissing: (id, branch) => `A condição "${id}" não define o caminho "${branch}"`,
  },
  workspace: {
    title: 'Fluxos',
    subtitle: 'Desenhe o caminho da conversa e publique quando estiver pronto',
    loading: 'Carregando fluxos…',
    loadError: 'Não foi possível carregar os fluxos',
    saveGraph: 'Publicar',
    saving: 'Publicando…',
    saveSuccess: 'Publicado',
    saveError: 'Não foi possível publicar',
    organize: 'Organizar',
    organizeTooltip: 'Recalcula a posição de todos os cards',
    discardChanges: 'Descartar',
    discardTooltip: 'Volta ao que está publicado, perdendo as alterações desta sessão',
    discardConfirm: 'Descartar as alterações não publicadas?',
    unsavedChangesConfirm: 'Há alterações não publicadas. Continuar e perdê-las?',
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
    collectionChain: { ...DEFAULT_FLOW_EDITOR_LABELS.collectionChain, ...override.collectionChain },
    flowManager: { ...DEFAULT_FLOW_EDITOR_LABELS.flowManager, ...override.flowManager },
    validation: { ...DEFAULT_FLOW_EDITOR_LABELS.validation, ...override.validation },
    workspace: { ...DEFAULT_FLOW_EDITOR_LABELS.workspace, ...override.workspace },
  }
}
