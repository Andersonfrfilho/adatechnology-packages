/**
 * Timing do cancelamento (evento 110111). A janela válida do dhEvento é apertada:
 * `dhEmi <= dhEvento <= horaSEFAZ`. Se o relógio local estiver adiantado, um dhEvento "agora"
 * cai no futuro → cStat 578 ("data do evento maior que a data do processamento").
 * Recuamos alguns segundos (buffer) e re-tentamos; se recuar demais logo após a emissão,
 * pode dar 577 ("menor que a data de emissão"), que o retry resolve conforme o tempo avança.
 */
export const CANCEL_TIMING_REJECT_CODES = new Set(['577', '578'])
export const CANCEL_MAX_ATTEMPTS = 5
export const CANCEL_RETRY_DELAY_MS = 3_000
/** Recuo aplicado ao dhEvento para compensar relógio local adiantado. */
export const CANCEL_DH_EVENTO_PAST_MS = 5_000

/** dhEvento seguro: agora menos o buffer (contra clock skew). */
export function cancelEventoDate(): Date {
  return new Date(Date.now() - CANCEL_DH_EVENTO_PAST_MS)
}

export const cancelSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
