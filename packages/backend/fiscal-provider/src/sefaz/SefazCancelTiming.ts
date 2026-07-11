/**
 * Timing do cancelamento (evento 110111). A janela válida do dhEvento é apertada:
 * `dhEmi <= dhEvento <= horaSEFAZ`. Se o relógio local estiver adiantado, um dhEvento "agora"
 * cai no futuro → cStat 578 ("data do evento maior que a data do processamento").
 * Recuamos alguns segundos (buffer) e re-tentamos; se recuar demais logo após a emissão,
 * pode dar 577 ("menor que a data de emissão"), que o retry resolve conforme o tempo avança.
 */
export const CANCEL_TIMING_REJECT_CODES = new Set(['577', '578'])
export const CANCEL_MAX_ATTEMPTS = 6
export const CANCEL_RETRY_DELAY_MS = 3_000
/**
 * Recuo no dhEvento contra clock skew (endpoint de eventos da SEFAZ costuma estar 2–4s
 * atrás do relógio local). 8s cobre a folga sem risco prático de cair antes da emissão;
 * o retry resolve o 577 quando o cancelamento ocorre imediatamente após a emissão.
 */
export const CANCEL_DH_EVENTO_PAST_MS = 8_000

/**
 * Diferença (ms) entre o relógio da SEFAZ (dhRecbto do status) e o relógio local.
 * Usada para gerar o dhEvento na base de tempo da SEFAZ — imune a drift do relógio
 * local/container (Docker Desktop), que causa cStat 578/577.
 */
export function computeSefazOffsetMs(dhRecbto?: string): number {
  if (!dhRecbto) return 0
  const sefazMs = Date.parse(dhRecbto)
  return Number.isNaN(sefazMs) ? 0 : sefazMs - Date.now()
}

/** dhEvento na base de tempo da SEFAZ (agora + offset) menos um pequeno recuo. */
export function cancelEventoDate(sefazOffsetMs = 0): Date {
  return new Date(Date.now() + sefazOffsetMs - CANCEL_DH_EVENTO_PAST_MS)
}

export const cancelSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
