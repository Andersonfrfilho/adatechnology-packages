import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'

import {
  INITIAL_COPY_ANNOUNCEMENT,
  copyAnnouncementReducer,
  resolveLiveText,
  type CopyAnnouncementState,
} from './participantCopyAnnouncement'

const ANNOUNCEMENT_MS = 3000

const AnnounceContext = createContext<(text: string) => void>(() => undefined)
const AnnouncementContext = createContext<CopyAnnouncementState>(INITIAL_COPY_ANNOUNCEMENT)

export function useAnnounceCopy(): (text: string) => void {
  return useContext(AnnounceContext)
}

/** Holds the text of the conversation's single polite region; the copy buttons announce through it. */
export function ParticipantCopyAnnouncer({ children }: { readonly children: ReactNode }) {
  const [announcement, dispatch] = useReducer(copyAnnouncementReducer, INITIAL_COPY_ANNOUNCEMENT)
  const announce = useCallback((text: string): void => dispatch({ type: 'announce', text }), [])

  useEffect(() => {
    if (announcement.text === '') return undefined
    const timer = setTimeout(() => dispatch({ type: 'expired' }), ANNOUNCEMENT_MS)
    return () => clearTimeout(timer)
  }, [announcement.tick, announcement.text])

  return (
    <AnnounceContext.Provider value={announce}>
      <AnnouncementContext.Provider value={announcement}>{children}</AnnouncementContext.Provider>
    </AnnounceContext.Provider>
  )
}

/** The one aria-live region of the thread: new-message notice, or the last copy announcement. */
export function ParticipantThreadLive({ notice }: { readonly notice: string }) {
  const copy = useContext(AnnouncementContext)
  const baselineNotice = useRef<string | undefined>(undefined)
  const resolution = resolveLiveText({ copy, notice, baselineNotice: baselineNotice.current })
  baselineNotice.current = resolution.baselineNotice
  return (
    <div className="cv-p-thread__live" role="status" aria-live="polite">
      {resolution.text}
    </div>
  )
}
