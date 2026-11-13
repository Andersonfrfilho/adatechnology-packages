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

export type ProtocolCopyState = {
  readonly copyCount: number
  readonly isCopied: boolean
}

export type ProtocolCopyAction = { readonly type: 'copied' } | { readonly type: 'expired' }

export const INITIAL_PROTOCOL_COPY_STATE: ProtocolCopyState = { copyCount: 0, isCopied: false }

/** The counter changes on every copy so a repeat inside the window restarts the timer. */
export function protocolCopyReducer(state: ProtocolCopyState, action: ProtocolCopyAction): ProtocolCopyState {
  if (action.type === 'copied') return { copyCount: state.copyCount + 1, isCopied: true }
  return { ...state, isCopied: false }
}
