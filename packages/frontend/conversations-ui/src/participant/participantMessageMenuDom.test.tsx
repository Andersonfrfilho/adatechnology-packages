import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { act } from 'react'

import { setupDom, pressKey, type DomHarness } from '../domHarness.test-helper'
import { ParticipantMessageMenuProvider } from './ParticipantMessageMenuContext'
import { ParticipantSelectionBar } from './ParticipantSelectionBar'
import { ParticipantTimeline } from './ParticipantTimeline'
import { buildMessage } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'
import type { ParticipantMessageMenuOptions } from './participantMessageMenuModel'
import type { ParticipantTimelineItem } from './participantMessages'
import { useParticipantMessageMenu } from './ParticipantMessageMenuContext'

let harness: DomHarness

beforeAll(async () => {
  harness = await setupDom()
})
afterAll(() => harness.teardown())

const ITEMS: readonly ParticipantTimelineItem[] = [
  { kind: 'server', message: buildMessage({ id: 'm1', text: 'First', direction: 'inbound', authorName: 'Bruno' }) },
  { kind: 'server', message: buildMessage({ id: 'm2', text: 'Second', direction: 'inbound', authorName: 'Bruno' }) },
]

function Bar() {
  const menu = useParticipantMessageMenu()
  return menu?.isSelecting ? <ParticipantSelectionBar state={menu} /> : null
}

function mount(options?: ParticipantMessageMenuOptions) {
  return harness.mount(
    <ParticipantMessageMenuProvider options={options} labels={LABELS} items={ITEMS}>
      <div className="cv-p-thread__scroll">
        <ParticipantTimeline items={ITEMS} labels={LABELS} resolveAttachmentUrl={() => Promise.resolve('')} />
      </div>
      <Bar />
    </ParticipantMessageMenuProvider>,
  )
}

function fire(element: Element, type: string): void {
  act(() => element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })))
}

function menuLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent ?? '')
}

describe('message menu in a DOM', () => {
  it('draws nothing new when the host did not opt in', () => {
    const { container, unmount } = mount()
    expect(container.querySelector('.cv-p-message-menu')).toBeNull()
    unmount()
  })

  it('opens from the chevron with Copy, Select messages and the host entries', () => {
    const forward = { id: 'forward', label: 'Forward', onSelect: () => undefined }
    const { container, unmount } = mount({ items: () => [forward] })
    const trigger = container.querySelector<HTMLButtonElement>('.cv-p-message-menu__trigger')!
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    fire(trigger, 'click')
    expect(menuLabels(container)).toEqual(['Copy', 'Select messages', 'Message info', 'Forward'])
    unmount()
  })

  it('opens from a right-click on the bubble', () => {
    const { container, unmount } = mount({})
    fire(container.querySelector('.cv-p-bubble')!, 'contextmenu')
    expect(menuLabels(container)).toEqual(['Copy', 'Select messages', 'Message info'])
    unmount()
  })

  it('selects messages with a check box per row, a bar with the count, and Escape leaves', () => {
    let received: readonly string[] = []
    const { container, unmount } = mount({
      selectionActions: () => [
        { id: 'fw', label: 'Forward all', onSelect: (messages) => (received = messages.map((m) => m.id)) },
      ],
    })
    fire(container.querySelectorAll('.cv-p-message-menu__trigger')[1]!, 'click')
    fire(
      Array.from(container.querySelectorAll('[role="menuitem"]')).find(
        (item) => item.textContent === 'Select messages',
      )!,
      'click',
    )
    expect(container.querySelectorAll('.cv-p-select-row').length).toBe(2)
    expect(container.querySelector('.cv-p-selection-bar__count')?.textContent).toBe('1 selected')
    fire(container.querySelectorAll('.cv-p-select-row')[0]!, 'click')
    expect(container.querySelector('.cv-p-selection-bar__count')?.textContent).toBe('2 selected')
    fire(
      Array.from(container.querySelectorAll('.cv-p-selection-bar__action')).find(
        (b) => b.textContent === 'Forward all',
      )!,
      'click',
    )
    expect(received).toEqual(['m1', 'm2'])
    expect(container.querySelector('.cv-p-selection-bar')).toBeNull()
    fire(container.querySelector('.cv-p-message-menu__trigger')!, 'click')
    fire(
      Array.from(container.querySelectorAll('[role="menuitem"]')).find(
        (item) => item.textContent === 'Select messages',
      )!,
      'click',
    )
    pressKey(document.body, 'Escape')
    expect(container.querySelector('.cv-p-select-row')).toBeNull()
    unmount()
  })
})
