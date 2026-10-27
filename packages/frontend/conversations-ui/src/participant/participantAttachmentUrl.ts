const SAFE_ATTACHMENT_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'http:', 'blob:'])

/** The resolved URL comes from the host: only network and blob schemes reach href/src; relative urls are refused. */
export function isSafeAttachmentUrl(url: string): boolean {
  try {
    return SAFE_ATTACHMENT_PROTOCOLS.has(new URL(url.trim()).protocol)
  } catch {
    return false
  }
}
