import type { FlowGraphData, FlowGraphSummary } from '@adatechnology/meta-whatsapp-contracts'
import type { FlowGraphRepository } from '../repositories/FlowGraphRepository'

// T4.2 — CRUD de grafo, agrupado num único arquivo (cada use-case é uma classe fina sobre o
// mesmo repositório; não há regra de negócio própria a proteger na sua separação em arquivos
// individuais como fizemos para conversation/session).

export class GetFlowGraphUseCase {
  constructor(private readonly flowGraphRepository: FlowGraphRepository) {}
  async execute(params: { companyId: string; key: string }): Promise<FlowGraphData | undefined> {
    return this.flowGraphRepository.get(params.companyId, params.key)
  }
}

export class ListFlowGraphsUseCase {
  constructor(private readonly flowGraphRepository: FlowGraphRepository) {}
  async execute(params: { companyId: string }): Promise<FlowGraphSummary[]> {
    return this.flowGraphRepository.list(params.companyId)
  }
}

export type CreateFlowGraphParams = {
  companyId: string
  key: string
  label: string
  startNodeId: string
  nodes: FlowGraphData['nodes']
  showInMenu?: boolean
  menuOptionLabel?: string
}

export class CreateFlowGraphUseCase {
  constructor(private readonly flowGraphRepository: FlowGraphRepository) {}
  async execute(params: CreateFlowGraphParams): Promise<FlowGraphData> {
    return this.flowGraphRepository.create(params.companyId, params)
  }
}

export type SaveFlowGraphParams = {
  companyId: string
  graph: FlowGraphData
  expectedVersion: number
}

// Salvar já é publicar — o motor de fluxo lê o grafo em tempo real (ver rules/packages/
// pluggable-module.md e tasks.md T4.2). A validação de conteúdo (destinos quebrados, opções
// duplicadas, etc.) é responsabilidade do editor (conversations-ui/flows validateGraph), não
// deste use-case — aqui só garantimos a consistência otimista da escrita.
export class SaveFlowGraphUseCase {
  constructor(private readonly flowGraphRepository: FlowGraphRepository) {}
  async execute(params: SaveFlowGraphParams): Promise<FlowGraphData> {
    return this.flowGraphRepository.save(params.companyId, params.graph, params.expectedVersion)
  }
}

export class DeleteFlowGraphUseCase {
  constructor(private readonly flowGraphRepository: FlowGraphRepository) {}
  async execute(params: { companyId: string; key: string }): Promise<void> {
    return this.flowGraphRepository.delete(params.companyId, params.key)
  }
}

export class GetLiveFlowPositionsUseCase {
  constructor(private readonly flowGraphRepository: FlowGraphRepository) {}
  async execute(params: { companyId: string }) {
    return this.flowGraphRepository.getLiveFlowPositions(params.companyId)
  }
}
