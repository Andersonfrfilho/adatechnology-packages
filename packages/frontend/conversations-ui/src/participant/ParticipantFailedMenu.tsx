import { useId } from 'react'

import { ParticipantFailedMenuList } from './ParticipantFailedMenuList'
import { DEFAULT_MESSAGE_OPTIONS_LABEL, type ParticipantConversationsLabels } from './participantLabels'
import { useParticipantFailedMenu } from './useParticipantFailedMenu'

type ParticipantFailedMenuProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onEdit?: () => void
  readonly onDiscard?: () => void
}

export function ParticipantFailedMenu({ labels, onEdit, onDiscard }: ParticipantFailedMenuProps) {
  const menu = useParticipantFailedMenu()
  const triggerId = useId()
  if (!onEdit && !onDiscard) return null
  const label = labels.messageOptions ?? DEFAULT_MESSAGE_OPTIONS_LABEL

  return (
    <span className="cv-p-failed-menu" ref={menu.containerRef} onBlur={menu.handleBlur}>
      <button
        type="button"
        id={triggerId}
        ref={menu.triggerRef}
        className="cv-p-failed-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={menu.state.isOpen}
        aria-label={label}
        data-cv-tooltip={menu.state.isOpen ? undefined : label}
        onClick={menu.handleTriggerClick}
        onKeyDown={menu.handleTriggerKeyDown}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {menu.state.isOpen ? (
        <ParticipantFailedMenuList menu={menu} labelledBy={triggerId} labels={labels} onEdit={onEdit} onDiscard={onDiscard} />
      ) : null}
    </span>
  )
}
