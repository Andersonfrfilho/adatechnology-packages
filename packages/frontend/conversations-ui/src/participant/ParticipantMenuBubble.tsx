import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { ParticipantMessageMenu } from './ParticipantMessageMenu'
import type { ParticipantMessageMenuState } from './ParticipantMessageMenuContext'
import {
  renderParticipantBubble,
  type BubbleContent,
  type ParticipantMessageBubbleProps,
} from './ParticipantMessageBubble'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as DEFAULTS } from './participantLabels'
import { selectedTextWithin } from './participantMessageMenuModel'
import { useParticipantFailedMenu } from './useParticipantFailedMenu'

const LONG_PRESS_MS = 500

type ParticipantMenuBubbleProps = {
  readonly props: ParticipantMessageBubbleProps
  readonly content: BubbleContent
  readonly textId: string
  readonly state: ParticipantMessageMenuState
}

/** A server bubble with the message menu: chevron on hover, right-click or long press, and selection mode. */
export function ParticipantMenuBubble({ props, content, textId, state }: ParticipantMenuBubbleProps) {
  const menu = useParticipantFailedMenu()
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [selectedText, setSelectedText] = useState('')
  const id = content.messageId ?? ''
  const message = state.messages.find((candidate) => candidate.id === id)

  function captureSelection(): void {
    if (!menu.state.isOpen) setSelectedText(selectedTextWithin(bubbleRef.current))
  }

  function openFromGesture(): void {
    captureSelection()
    if (!menu.state.isOpen) menu.open()
  }

  function cancelPress(): void {
    clearTimeout(pressTimer.current)
  }

  if (state.isSelecting)
    return (
      <SelectRow state={state} id={id}>
        {renderParticipantBubble({ props, content, textId })}
      </SelectRow>
    )
  if (!message) return renderParticipantBubble({ props, content, textId })

  return renderParticipantBubble({
    props,
    content,
    textId,
    frame: {
      ref: bubbleRef,
      className: menu.state.isOpen ? 'cv-p-bubble--menu-open' : undefined,
      handlers: {
        onContextMenu: (event) => {
          event.preventDefault()
          openFromGesture()
        },
        onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
          if (event.pointerType !== 'touch') return
          cancelPress()
          pressTimer.current = setTimeout(openFromGesture, LONG_PRESS_MS)
        },
        onPointerUp: cancelPress,
        onPointerCancel: cancelPress,
        onPointerMove: cancelPress,
      },
      corner: (
        <ParticipantMessageMenu
          menu={menu}
          state={state}
          message={message}
          selectedText={selectedText}
          onTriggerPointerDown={captureSelection}
        />
      ),
    },
  })
}

type SelectRowProps = { readonly state: ParticipantMessageMenuState; readonly id: string; readonly children: ReactNode }

/** Selection mode: a check box beside the bubble; a click anywhere on the row checks or unchecks it. */
function SelectRow({ state, id, children }: SelectRowProps) {
  const isSelected = state.selectedIds.includes(id)
  const label = state.labels.selectMessage ?? DEFAULTS.selectMessage ?? ''
  return (
    <div className="cv-p-select-row" data-selected={isSelected ? 'true' : undefined} onClick={() => state.toggle(id)}>
      <input
        type="checkbox"
        className="cv-p-select-row__check"
        checked={isSelected}
        aria-label={label}
        onChange={() => state.toggle(id)}
        onClick={(event) => event.stopPropagation()}
      />
      {children}
    </div>
  )
}
