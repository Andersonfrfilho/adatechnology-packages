import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import { flowGraphNodesSchema } from '@adatechnology/meta-whatsapp-contracts'
import type {
  FlowGraphData,
  FlowGraphSummary,
  FlowNodeData,
  LiveFlowPosition,
} from '@adatechnology/meta-whatsapp-contracts'
import { sessions, flowGraphs, type FlowGraphRow } from '../schema/schema'
import type { FlowGraphCache } from './FlowGraphCache'

export class InvalidFlowGraphError extends Error {
  constructor(
    key: string,
    public readonly validationMessage: string,
  ) {
    super(`Grafo do fluxo "${key}" está malformado no banco: ${validationMessage}`)
    this.name = 'InvalidFlowGraphError'
  }
}

// O jsonb `nodes` entrou pelo editor (dado de origem cliente) e volta do banco como `unknown`.
// Validar aqui, na fronteira, faz um grafo corrompido falhar com a causa explícita em vez de
// virar comportamento estranho lá dentro do interpretador.
function toContractGraph(row: FlowGraphRow): FlowGraphData {
  const parsed = flowGraphNodesSchema.safeParse(row.nodes)
  if (!parsed.success) throw new InvalidFlowGraphError(row.key, parsed.error.message)

  return {
    key: row.key,
    label: row.label,
    startNodeId: row.startNodeId,
    version: row.version,
    nodes: parsed.data as Record<string, FlowNodeData>,
  }
}

export class OptimisticLockError extends Error {
  constructor(key: string) {
    super(`Fluxo "${key}" foi alterado por outra sessão — recarregue antes de salvar.`)
    this.name = 'OptimisticLockError'
  }
}

// T4.2 — CRUD de grafo de fluxo, mais a consulta de posições ao vivo (quantas sessões estão
// em cada nó agora) que alimenta o liveCount no editor visual (FlowNodeCardData).
export class FlowGraphRepository {
  // Cache opcional: sem ele o repositório se comporta exatamente como antes, lendo sempre do
  // banco. É o host que decide se quer cachear e com qual provedor (ver CacheInterface).
  constructor(
    private readonly db: MetaWhatsAppDatabase,
    private readonly cache?: FlowGraphCache,
  ) {}

  async get(companyId: string, key: string): Promise<FlowGraphData | undefined> {
    const cached = await this.cache?.read(companyId, key)
    if (cached) return cached

    const [row] = await this.db
      .select()
      .from(flowGraphs)
      .where(and(eq(flowGraphs.companyId, companyId), eq(flowGraphs.key, key)))
      .limit(1)
    if (!row) return undefined

    const graph = toContractGraph(row)
    await this.cache?.write(companyId, graph)
    return graph
  }

  async list(companyId: string): Promise<FlowGraphSummary[]> {
    const rows = await this.db.select().from(flowGraphs).where(eq(flowGraphs.companyId, companyId))
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      nodeCount: Object.keys(row.nodes as Record<string, unknown>).length,
      showInMenu: row.showInMenu,
      menuOptionLabel: row.menuOptionLabel ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
    }))
  }

  // Valida antes de gravar: aceitar um grafo malformado e só reclamar na leitura empurraria a
  // falha para o meio de uma conversa real, em vez de barrar quem salvou.
  private assertValidNodes(key: string, nodes: unknown): void {
    const parsed = flowGraphNodesSchema.safeParse(nodes)
    if (!parsed.success) throw new InvalidFlowGraphError(key, parsed.error.message)
  }

  async create(
    companyId: string,
    graph: Omit<FlowGraphData, 'version'> & { showInMenu?: boolean; menuOptionLabel?: string },
  ): Promise<FlowGraphData> {
    this.assertValidNodes(graph.key, graph.nodes)

    const [created] = await this.db
      .insert(flowGraphs)
      .values({
        companyId,
        key: graph.key,
        label: graph.label,
        startNodeId: graph.startNodeId,
        nodes: graph.nodes,
        showInMenu: graph.showInMenu ?? false,
        menuOptionLabel: graph.menuOptionLabel,
      })
      .returning()

    const createdGraph = toContractGraph(created!)
    await this.cache?.invalidate(companyId, createdGraph.key)
    return createdGraph
  }

  // Lock otimista: a escrita só aplica se `expectedVersion` ainda bater com o que está salvo —
  // senão, alguém mais salvou entretanto e o editor precisa recarregar (ver comentário no schema).
  async save(companyId: string, graph: FlowGraphData, expectedVersion: number): Promise<FlowGraphData> {
    this.assertValidNodes(graph.key, graph.nodes)

    const rows = await this.db
      .update(flowGraphs)
      .set({
        label: graph.label,
        startNodeId: graph.startNodeId,
        nodes: graph.nodes,
        version: expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(flowGraphs.companyId, companyId),
          eq(flowGraphs.key, graph.key),
          eq(flowGraphs.version, expectedVersion),
        ),
      )
      .returning()

    if (rows.length === 0) throw new OptimisticLockError(graph.key)

    // Invalida em vez de reescrever a entrada com o grafo novo: reescrever perderia a corrida
    // contra uma leitura concorrente que já tivesse buscado a versão anterior e ainda não tivesse
    // gravado — o cache ficaria com o grafo velho, com TTL cheio pela frente.
    await this.cache?.invalidate(companyId, graph.key)
    return toContractGraph(rows[0]!)
  }

  async delete(companyId: string, key: string): Promise<void> {
    await this.db.delete(flowGraphs).where(and(eq(flowGraphs.companyId, companyId), eq(flowGraphs.key, key)))
    await this.cache?.invalidate(companyId, key)
  }

  // T4.2 — GetLiveFlowPositions: agrega sessões ativas por (flowKey, currentNodeId), lendo as
  // colunas dedicadas gravadas por SessionRepository.setFlowPosition. Agrega no banco (GROUP BY,
  // coberto por idx_sessions_company_flow_node) em vez de trazer toda sessão da empresa para
  // contar em memória.
  async getLiveFlowPositions(companyId: string): Promise<LiveFlowPosition[]> {
    const rows = await this.db
      .select({
        flowKey: sessions.flowKey,
        nodeId: sessions.currentNodeId,
        count: sql<number>`count(*)::int`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.companyId, companyId),
          eq(sessions.mode, 'bot'),
          isNotNull(sessions.flowKey),
          isNotNull(sessions.currentNodeId),
        ),
      )
      .groupBy(sessions.flowKey, sessions.currentNodeId)

    return rows.map((row) => ({ flowKey: row.flowKey!, nodeId: row.nodeId!, count: row.count }))
  }
}
