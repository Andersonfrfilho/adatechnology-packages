import { useEffect, useRef, useState, type RefObject } from 'react'

export type TranscriptionOverflow = {
  readonly textRef: RefObject<HTMLParagraphElement | null>
  readonly isOverflowing: boolean
}

/** Measures the clamped paragraph; nothing is claimed before layout exists (server render, first paint). */
export function useTranscriptionOverflow(text: string, isExpanded: boolean): TranscriptionOverflow {
  const textRef = useRef<HTMLParagraphElement | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const element = textRef.current
    if (!element || isExpanded) return undefined
    const measure = (): void => setIsOverflowing(element.scrollHeight > element.clientHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, isExpanded])

  return { textRef, isOverflowing }
}
