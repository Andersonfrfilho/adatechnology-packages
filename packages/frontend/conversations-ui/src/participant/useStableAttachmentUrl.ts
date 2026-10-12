import { useCallback, useEffect, useRef, useState } from 'react'

import type { ParticipantAttachment } from '@adatechnology/conversation-contracts'

import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import { isSafeAttachmentUrl } from './participantAttachmentUrl'

export type StableAttachmentUrl = {
  readonly status: 'pending' | 'ready' | 'failed'
  readonly url: string | undefined
  /** Asks the host for a fresh URL (the signed one expired); resolves undefined when it cannot. */
  readonly resolveAgain: () => Promise<string | undefined>
}

export type StableAttachmentUrlParams = {
  readonly attachment: ParticipantAttachment
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
}

type ResolvedState = Pick<StableAttachmentUrl, 'status' | 'url'>

export const ATTACHMENT_URL_RETRY_DELAY_MS = 1000

const PENDING_STATE: ResolvedState = { status: 'pending', url: undefined }

async function resolveSafely({ attachment, resolveAttachmentUrl }: StableAttachmentUrlParams): Promise<string | undefined> {
  try {
    const resolved = await resolveAttachmentUrl(attachment, 'inline')
    return isSafeAttachmentUrl(resolved) ? resolved.trim() : undefined
  } catch {
    return undefined
  }
}

/** Resolves once per `attachment.id`: a refreshed conversation hands over a new object and URL, and swapping `src` restarts the audio. */
export function useStableAttachmentUrl(params: StableAttachmentUrlParams): StableAttachmentUrl {
  const latest = useRef(params)
  const currentId = useRef(params.attachment.id)
  const [state, setState] = useState<ResolvedState>(PENDING_STATE)
  const { id } = params.attachment

  useEffect(() => {
    latest.current = params
  })

  useEffect(() => {
    currentId.current = id
    setState(PENDING_STATE)
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const settle = (url: string | undefined): void => {
      if (currentId.current === id) setState(url ? { status: 'ready', url } : { status: 'failed', url: undefined })
    }
    resolveSafely(latest.current).then((url) => {
      if (url || currentId.current !== id) return settle(url)
      retryTimer = setTimeout(() => void resolveSafely(latest.current).then(settle), ATTACHMENT_URL_RETRY_DELAY_MS)
    })
    return () => {
      currentId.current = ''
      clearTimeout(retryTimer)
    }
  }, [id])

  const resolveAgain = useCallback(async (): Promise<string | undefined> => {
    const requestedId = currentId.current
    const url = await resolveSafely(latest.current)
    if (url && currentId.current === requestedId) setState({ status: 'ready', url })
    return url
  }, [])

  return { ...state, resolveAgain }
}
