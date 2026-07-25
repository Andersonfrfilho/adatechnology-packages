import { and, eq } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'
import type { FlowGraphData, FlowGraphSummary, FlowNodeData } from '@adatechnology/meta-whatsapp-contracts'
import { sessions, flowGraphs, type FlowGraphRow } from '../schema/schema'

function toContractGraph(row: FlowGraphRow): FlowGraphData {
  return {
    key: row.key,
    label: row.label,
    startNodeId: row.startNodeId,
    version: row.version,
    nodes: row.nodes as Record<string, FlowNodeData>,
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
  constructor(private readonly db: BunSQLDatabase<AnyRelations | EmptyRelations>) {}

  async get(companyId: string, key: string): Promise<FlowGraphData | undefined> {
    const [row] = await this.db
      .select()
      .from(flowGraphs)
      .where(and(eq(flowGraphs.companyId, companyId), eq(flowGraphs.key, key)))
      .limit(1)
    return row ? toContractGraph(row) : undefined
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

  async create(
    companyId: string,
    graph: Omit<FlowGraphData, 'version'> & { showInMenu?: boolean; menuOptionLabel?: string },
  ): Promise<FlowGraphData> {
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
    return toContractGraph(created!)
  }

  // Lock otimista: a escrita só aplica se `expectedVersion` ainda bater com o que está salvo —
  // senão, alguém mais salvou entretanto e o editor precisa recarregar (ver comentário no schema).
  async save(companyId: string, graph: FlowGraphData, expectedVersion: number): Promise<FlowGraphData> {
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
    return toContractGraph(rows[0]!)
  }

  async delete(companyId: string, key: string): Promise<void> {
    await this.db.delete(flowGraphs).where(and(eq(flowGraphs.companyId, companyId), eq(flowGraphs.key, key)))
  }

  // T4.2 — GetLiveFlowPositions: agrega sessões ativas por (flowKey, nodeId). O flowKey vem do
  // prefixo de currentState convencionado como "<flowKey>:<nodeId>" — o host que grava o estado
  // nesse formato quando o interpretador (T4.3) transiciona entre nós.
  async getLiveFlowPositions(companyId: string): Promise<{ flowKey: string; nodeId: string; count: number }[]> {
    const rows = await this.db
      .select({ currentState: sessions.currentState })
      .from(sessions)
      .where(and(eq(sessions.companyId, companyId), eq(sessions.mode, 'bot')))

    const counts = new Map<string, number>()
    for (const row of rows) {
      const separatorIndex = row.currentState.indexOf(':')
      if (separatorIndex === -1) continue
      counts.set(row.currentState, (counts.get(row.currentState) ?? 0) + 1)
    }

    return [...counts.entries()].map(([key, count]) => {
      const separatorIndex = key.indexOf(':')
      return { flowKey: key.slice(0, separatorIndex), nodeId: key.slice(separatorIndex + 1), count }
    })
  }
}
