/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type ActorParams = { readonly companyId: string; readonly actorId?: string }

/** Evento de gancho sem `actorId: undefined` (o host compara chaves, não só valores). */
export function actor(params: ActorParams): { companyId: string; actorId?: string } {
  return { companyId: params.companyId, ...(params.actorId ? { actorId: params.actorId } : {}) }
}
