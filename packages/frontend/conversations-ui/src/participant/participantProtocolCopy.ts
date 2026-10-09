export type ProtocolClipboard = {
  readonly writeText: (text: string) => Promise<void>
}

/** Failure is silent by design: the protocol stays visible and selectable. */
export async function copyProtocolToClipboard(
  protocol: string,
  clipboard: ProtocolClipboard | undefined,
): Promise<boolean> {
  if (clipboard === undefined) return false
  try {
    await clipboard.writeText(protocol)
    return true
  } catch {
    return false
  }
}
