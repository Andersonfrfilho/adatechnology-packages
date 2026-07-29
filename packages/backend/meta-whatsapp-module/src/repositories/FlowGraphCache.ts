import type { CacheInterface, FlowGraphData } from '@adatechnology/meta-whatsapp-contracts'

// Namespace na chave para o cache do host poder ser compartilhado com o resto da aplicação sem
// risco de colisão — o host escolhe onde o Redis mora, não como o módulo nomeia o que guarda.
const KEY_PREFIX = 'meta-whatsapp:flow-graph'

export const DEFAULT_FLOW_GRAPH_CACHE_TTL_SECONDS = 300

/**
 * Cache de leitura dos grafos de fluxo, com invalidação na publicação.
 *
 * TTL **e** invalidação explícita, e não um dos dois: só TTL deixaria o cliente andando no grafo
 * antigo até a chave expirar, logo depois de alguém corrigir o fluxo no editor; só invalidação
 * deixaria cache envenenado para sempre se um `delete` se perdesse (Redis reiniciando, deploy no
 * meio da escrita).
 *
 * Toda operação é tolerante a falha por decisão de projeto: cache é aceleração, não dependência.
 * Redis fora do ar tem que degradar para leitura no banco — que é exatamente o comportamento de
 * quem não configura cache nenhum — em vez de derrubar a conversa do cliente.
 */
export class FlowGraphCache {
  constructor(
    private readonly provider: CacheInterface,
    private readonly ttlSeconds: number = DEFAULT_FLOW_GRAPH_CACHE_TTL_SECONDS,
  ) {}

  // companyId na chave, e não só a flowKey: a chave do fluxo é escolhida por quem edita e se
  // repete entre empresas — 'consorcio' existe em todas — então uma chave sem tenant serviria o
  // grafo de uma empresa para a conversa de outra.
  private keyFor(companyId: string, flowKey: string): string {
    return `${KEY_PREFIX}:${companyId}:${flowKey}`
  }

  async read(companyId: string, flowKey: string): Promise<FlowGraphData | undefined> {
    try {
      const cached = await this.provider.get(this.keyFor(companyId, flowKey))
      if (!cached) return undefined
      return JSON.parse(cached) as FlowGraphData
    } catch {
      // Inclui JSON corrompido na chave: vale o mesmo que ausência, e o banco resolve.
      return undefined
    }
  }

  async write(companyId: string, graph: FlowGraphData): Promise<void> {
    try {
      await this.provider.set(this.keyFor(companyId, graph.key), JSON.stringify(graph), this.ttlSeconds)
    } catch {
      // Não conseguir acelerar não é motivo para falhar a leitura que já deu certo.
    }
  }

  async invalidate(companyId: string, flowKey: string): Promise<void> {
    try {
      await this.provider.delete(this.keyFor(companyId, flowKey))
    } catch {
      // Engolir aqui é seguro porque existe TTL: a entrada some sozinha em no máximo ttlSeconds.
      // Sem o TTL como rede, este catch seria um bug — o grafo velho ficaria para sempre.
    }
  }
}
