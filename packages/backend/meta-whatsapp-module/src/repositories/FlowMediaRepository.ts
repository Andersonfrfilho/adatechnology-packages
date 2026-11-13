import { and, asc, eq, sql } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import { flowMedia, type FlowMediaRow } from '../schema/schema'

export type FlowMediaLocation = {
  companyId: string
  flowKey: string
  nodeId: string
}

export type AttachFlowMediaParams = FlowMediaLocation & {
  uploadId: string
  filename: string
  mimeType: string
  sizeBytes: number
  caption?: string
  sortOrder?: number
}

export type UpdateFlowMediaParams = {
  companyId: string
  id: string
  caption?: string | null
  sortOrder?: number
  active?: boolean
}

// Biblioteca de mídia por nó de fluxo. Toda consulta é escopada por companyId — a chave do fluxo
// é escolhida por quem edita e repete entre empresas, então filtrar só por (flowKey, nodeId)
// vazaria arquivo de um tenant para outro.
export class FlowMediaRepository {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  private locationFilter(location: FlowMediaLocation) {
    return and(
      eq(flowMedia.companyId, location.companyId),
      eq(flowMedia.flowKey, location.flowKey),
      eq(flowMedia.nodeId, location.nodeId),
    )
  }

  // O que o nó realmente envia, na ordem de envio. `active` filtrado aqui e não no chamador:
  // é a razão de a coluna existir, e um chamador que esquecesse do filtro mandaria ao cliente
  // justamente o material que alguém desligou.
  async listActive(location: FlowMediaLocation): Promise<FlowMediaRow[]> {
    return this.db
      .select()
      .from(flowMedia)
      .where(and(this.locationFilter(location), eq(flowMedia.active, true)))
      .orderBy(asc(flowMedia.sortOrder), asc(flowMedia.createdAt))
  }

  // Inclui os desligados — é a visão do editor, onde desligar precisa continuar visível para
  // poder ser religado.
  async listAll(location: FlowMediaLocation): Promise<FlowMediaRow[]> {
    return this.db
      .select()
      .from(flowMedia)
      .where(this.locationFilter(location))
      .orderBy(asc(flowMedia.sortOrder), asc(flowMedia.createdAt))
  }

  /**
   * Anexa um arquivo já existente no storage ao nó.
   *
   * `onConflictDoUpdate` em vez de deixar estourar: reanexar o mesmo arquivo é clique repetido no
   * editor, e o esperado ali é atualizar a legenda/ordem — não um erro de índice único na cara de
   * quem está montando o fluxo.
   */
  async attach(params: AttachFlowMediaParams): Promise<FlowMediaRow> {
    const [row] = await this.db
      .insert(flowMedia)
      .values({
        companyId: params.companyId,
        flowKey: params.flowKey,
        nodeId: params.nodeId,
        uploadId: params.uploadId,
        filename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        caption: params.caption ?? null,
        sortOrder: params.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: [flowMedia.companyId, flowMedia.flowKey, flowMedia.nodeId, flowMedia.uploadId],
        set: {
          caption: params.caption ?? null,
          sortOrder: params.sortOrder ?? 0,
          active: true,
          updatedAt: sql`now()`,
        },
      })
      .returning()

    return row as FlowMediaRow
  }

  async update(params: UpdateFlowMediaParams): Promise<FlowMediaRow | undefined> {
    const [row] = await this.db
      .update(flowMedia)
      .set({
        ...(params.caption !== undefined ? { caption: params.caption } : {}),
        ...(params.sortOrder !== undefined ? { sortOrder: params.sortOrder } : {}),
        ...(params.active !== undefined ? { active: params.active } : {}),
        updatedAt: sql`now()`,
      })
      .where(and(eq(flowMedia.companyId, params.companyId), eq(flowMedia.id, params.id)))
      .returning()

    return row as FlowMediaRow | undefined
  }

  /**
   * Desanexa do nó. Não toca no storage de propósito: o mesmo `uploadId` pode estar anexado a
   * outro nó ou a outro fluxo, e apagar o binário aqui quebraria os demais. Quem apaga objeto é o
   * host, que é dono da biblioteca de arquivos.
   */
  async detach(params: { companyId: string; id: string }): Promise<void> {
    await this.db.delete(flowMedia).where(and(eq(flowMedia.companyId, params.companyId), eq(flowMedia.id, params.id)))
  }

  // Chamado ao salvar o grafo: nós apagados no editor deixam linhas que nada mais alcança.
  async detachRemovedNodes(params: { companyId: string; flowKey: string; existingNodeIds: string[] }): Promise<void> {
    const condition =
      params.existingNodeIds.length === 0 ? undefined : sql`${flowMedia.nodeId} NOT IN ${params.existingNodeIds}`

    await this.db
      .delete(flowMedia)
      .where(and(eq(flowMedia.companyId, params.companyId), eq(flowMedia.flowKey, params.flowKey), condition))
  }
}
