import type { FlowConditionOperator, FlowNodeType, FlowQuestionType } from './flowGraph'

export interface FlowEditorLabels {
  legend: Record<FlowNodeType, string>
  startNodeTooltip: string
  detachedNodeTooltip: string
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
    nodeName: string
    nodeNamePlaceholder: string
    nodeNameHint: string
    questionType: string
    question: string
    options: string
    addOption: string
    removeOption: string
    close: string
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
  collectionChain: {
    feeds: (label: string) => string
  }
  /**
   * Texto dos problemas encontrados por `validateGraph`. Vive aqui, e não no host, porque a tela
   * composta é quem valida — deixar de fora obrigaria todo produto a repassar o mesmo mapa de
   * funções só para a barra de erros aparecer.
   */
  validation: FlowValidationLabels
  /** Barra de cima, estados de carregamento e ações do editor inteiro. */
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
  flowManager: {
    newFlow: string
    createTitle: string
    key: string
    keyHint: string
    keyInvalid: string
    label: string
    showInMenu: string
    menuOptionLabel: string
    create: string
    creating: string
    deleteFlow: string
    deleteConfirm: (label: string) => string
    createError: string
    deleteError: string
  }
}

export interface FlowValidationLabels {
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
  detachedNodeTooltip: 'Sem ligação de entrada — o bot não chega neste nó. Puxe um fio de outro card até ele.',
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
    nodeName: 'Nome do nó (opcional)',
    nodeNamePlaceholder: 'Ex.: Enviar tabela de preços',
    nodeNameHint: 'Só aparece no editor — o cliente não vê.',
    questionType: 'Tipo de resposta',
    question: 'Texto da pergunta',
    options: 'Opções (choice)',
    addOption: 'Adicionar opção',
    removeOption: 'Remover opção',
    close: 'Fechar painel',
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
    toggleToMap: 'Mapa de fluxos',
    toggleToDetail: 'Voltar ao editor',
  },
  flowGroup: {
    focus: 'Focar neste fluxo',
    close: 'Fechar',
  },
  crossFlowPortal: {
    tooltip: 'Clique para abrir esse fluxo aqui do lado, ligado ao ponto de onde ele é chamado',
    goesTo: (label) => `↪ Vai para: ${label}`,
  },
  collectionChain: {
    feeds: (label) => `Alimenta: ${label}`,
  },
  validation: {
    title: 'Antes de publicar',
    errors: (count) => `${count} erro(s) — corrija antes de salvar`,
    warnings: (count) => `${count} aviso(s)`,
    noStart: 'O fluxo precisa de um nó inicial válido.',
    brokenRef: (from, to) => `Nó "${from}": ligação aponta para "${to}", que não existe.`,
    choiceWithoutOptions: (id) => `Nó "${id}": escolha sem nenhuma opção.`,
    duplicatedOptionId: (id, optionId) => `Nó "${id}": valor de opção "${optionId}" duplicado.`,
    optionWithoutTarget: (id, label) => `Nó "${id}": opção "${label}" não tem destino definido.`,
    tooManyOptions: (id, count) => `Nó "${id}": ${count} opções — o WhatsApp aceita no máximo 10 em lista.`,
    buttonTitleTooLong: (id, label) => `Nó "${id}": botão "${label}" passa de 20 caracteres.`,
    listTitleTooLong: (id, label) => `Nó "${id}": item de lista "${label}" passa de 24 caracteres.`,
    bodyTooLong: (id) => `Nó "${id}": texto passa de 1024 caracteres.`,
    unreachable: (id) => `Nó "${id}" é inalcançável a partir do início do fluxo.`,
    deadEndQuestion: (id) => `Nó "${id}": pergunta sem próximo passo definido.`,
    conditionIncomplete: (id) => `Nó "${id}": condição incompleta — defina variável, operador e valor.`,
    conditionBranchMissing: (id, branch) =>
      `Nó "${id}": ramo "${branch === 'true' ? 'Verdadeiro' : 'Falso'}" sem destino definido.`,
  },
  workspace: {
    title: 'Fluxos do Bot',
    subtitle: 'Blueprint visual dos fluxos de conversa, sincronizado com o que está em produção.',
    loading: 'Carregando fluxos…',
    loadError: 'Não foi possível carregar os fluxos.',
    saveGraph: 'Publicar alterações',
    saving: 'Publicando…',
    saveSuccess: 'Fluxo publicado! O bot já está usando a versão nova.',
    saveError: 'Não foi possível salvar — verifique se todos os destinos apontam para nós existentes.',
    organize: 'Organizar',
    organizeTooltip: 'Reorganiza os nós automaticamente e salva as novas posições',
    discardChanges: 'Desfazer alterações',
    discardTooltip: 'Devolve os fluxos abertos ao que está publicado, descartando o que não foi salvo',
    discardConfirm: 'Descartar todas as alterações não publicadas e voltar ao fluxo que está no ar?',
    unsavedChangesConfirm:
      'Você tem alterações não publicadas neste fluxo. Trocar de fluxo agora descarta essas edições. Continuar?',
  },
  flowManager: {
    newFlow: 'Novo fluxo',
    createTitle: 'Criar novo fluxo',
    key: 'Identificador único',
    keyHint: 'letras minúsculas, números e _ (ex.: promocoes_semana)',
    keyInvalid: 'Use apenas letras minúsculas, números e _ (2 a 40 caracteres)',
    label: 'Nome exibido',
    showInMenu: 'Exibir como opção no menu principal do bot',
    menuOptionLabel: 'Texto da opção no menu',
    create: 'Criar fluxo',
    creating: 'Criando…',
    deleteFlow: 'Excluir fluxo',
    deleteConfirm: (label) => `Excluir o fluxo "${label}"? Esta ação não pode ser desfeita.`,
    createError: 'Não foi possível criar o fluxo.',
    deleteError: 'Não foi possível excluir o fluxo.',
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
    validation: { ...DEFAULT_FLOW_EDITOR_LABELS.validation, ...override.validation },
    workspace: { ...DEFAULT_FLOW_EDITOR_LABELS.workspace, ...override.workspace },
    flowManager: { ...DEFAULT_FLOW_EDITOR_LABELS.flowManager, ...override.flowManager },
  }
}
