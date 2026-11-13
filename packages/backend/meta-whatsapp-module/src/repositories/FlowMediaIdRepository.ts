import { eq, sql } from 'drizzle-orm'

import type { MetaWhatsAppDatabase } from '../database.types'
import type { FlowMediaIdStore } from '../flows/createSendMediaAction'
import { flowMedia } from '../schema/schema'

/**
 * Store padrão do cache de `mediaId`, na própria linha da biblioteca de mídia.
 *
 * A porta `FlowMediaIdStore` existe para o host poder escolher Redis ou memória. Esta é a
 * implementação que o módulo já traz pronta, para o caso comum não exigir nada de quem instala: a
 * tabela é do módulo, a coluna é do módulo, e sem isso todo host reescreveria o mesmo repositório.
 *
 * Um mapa por `phone_number_id` na mesma linha, e não uma tabela à parte: o id não existe sem o
 * arquivo, morre com ele, e a linha é lida de qualquer forma no envio.
 */
export class FlowMediaIdRepository implements FlowMediaIdStore {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  async get(params: { flowMediaId: string; senderKey: string }): Promise<string | undefined> {
    const rows = await this.db
      .select({ ids: flowMedia.metaMediaIds })
      .from(flowMedia)
      .where(eq(flowMedia.id, params.flowMediaId))
      .limit(1)

    return rows[0]?.ids?.[params.senderKey]
  }

  /**
   * Grava só a chave deste número.
   *
   * `jsonb_set` no banco, e não ler-alterar-escrever na aplicação: dois clientes passando pelo nó
   * ao mesmo tempo com números diferentes leriam o mesmo mapa e o último gravaria por cima,
   * apagando o id do outro. A escrita atômica não tem essa janela.
   */
  async set(params: { flowMediaId: string; senderKey: string; mediaId: string }): Promise<void> {
    await this.db
      .update(flowMedia)
      .set({
        metaMediaIds: sql`jsonb_set(${flowMedia.metaMediaIds}, ARRAY[${params.senderKey}::text], to_jsonb(${params.mediaId}::text), true)`,
      })
      .where(eq(flowMedia.id, params.flowMediaId))
  }

  /** Remove só a chave deste número — o id do outro número continua válido. */
  async clear(params: { flowMediaId: string; senderKey: string }): Promise<void> {
    await this.db
      .update(flowMedia)
      .set({ metaMediaIds: sql`${flowMedia.metaMediaIds} - ${params.senderKey}::text` })
      .where(eq(flowMedia.id, params.flowMediaId))
  }
}
