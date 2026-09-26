/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF7, D7: a atribuição genérica decide sozinha quando há referência de resposta ou uma única
 * candidata aberta. Quando há mais de uma, o produto pode ter regra própria de "atribuível" (ex.:
 * a 183 só considera aberta a tratativa que não chegou a estado terminal) — `filterCandidates` é
 * onde essa regra entra, como porta **opcional**: ausente, todas as conversas abertas do
 * participante contam.
 */
import type { ConversationChannel } from '@adatechnology/conversation-contracts'

import type { ConversationRow } from '../schema/schema'

export type FilterConversationCandidatesInput = {
  readonly companyId: string
  readonly channel: ConversationChannel
  readonly identifier: string
  readonly candidates: readonly ConversationRow[]
}

export type FilterConversationCandidatesPort = {
  filter(input: FilterConversationCandidatesInput): Promise<readonly ConversationRow[]>
}
