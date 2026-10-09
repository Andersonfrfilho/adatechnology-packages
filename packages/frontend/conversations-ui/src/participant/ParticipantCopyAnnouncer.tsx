import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const ANNOUNCEMENT_MS = 3000

const AnnounceContext = createContext<(text: string) => void>(() => undefined)
const AnnouncementContext = createContext('')

export function useAnnounceCopy(): (text: string) => void {
  return useContext(AnnounceContext)
}

/** Holds the text of the conversation's single polite region; the copy buttons announce through it. */
export function ParticipantCopyAnnouncer({ children }: { readonly children: ReactNode }) {
  const [announcement, setAnnouncement] = useState('')
  const announce = useCallback((text: string): void => setAnnouncement(text), [])

  useEffect(() => {
    if (announcement === '') return undefined
    const timer = setTimeout(() => setAnnouncement(''), ANNOUNCEMENT_MS)
    return () => clearTimeout(timer)
  }, [announcement])

  return (
    <AnnounceContext.Provider value={announce}>
      <AnnouncementContext.Provider value={announcement}>{children}</AnnouncementContext.Provider>
    </AnnounceContext.Provider>
  )
}

/** The one aria-live region of the thread: new-message notice, or the last copy announcement. */
export function ParticipantThreadLive({ notice }: { readonly notice: string }) {
  const copyAnnouncement = useContext(AnnouncementContext)
  return (
    <div className="cv-p-thread__live" role="status" aria-live="polite">
      {copyAnnouncement === '' ? notice : copyAnnouncement}
    </div>
  )
}
