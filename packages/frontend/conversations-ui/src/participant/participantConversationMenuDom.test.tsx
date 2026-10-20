import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { act } from 'react'

import { setupDom, pressKey, type DomHarness } from '../domHarness.test-helper'
import { ParticipantConversationMenu } from './ParticipantConversationMenu'
import { ParticipantMessageMenuProvider, useParticipantMessageMenu } from './ParticipantMessageMenuContext'
import { ParticipantTimeline } from './ParticipantTimeline'
import { buildMessage } from './participantFixtures.test-helper'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'
import type { ParticipantTimelineItem } from './participantMessages'

let harness: DomHarness

beforeAll(async () => {
  harness = await setupDom()
})
afterAll(() => harness.teardown())

const ITEMS: readonly ParticipantTimelineItem[] = [
  {
    kind: 'server',
    message: buildMessage({
      id: 'm1',
      text: 'Mine',
      direction: 'inbound',
      status: 'read',
      readAt: '2026-10-01T10:30:00.000Z',
    }),
  },
]

function HeaderMenu() {
  const menu = useParticipantMessageMenu()
  return menu ? (
    <>
      <ParticipantConversationMenu state={menu} title="Order 12" />
      <span data-testid="selecting">{menu.isSelecting ? `on:${menu.selectedIds.length}` : 'off'}</span>
    </>
  ) : null
}

function mount() {
  return harness.mount(
    <ParticipantMessageMenuProvider options={{}} labels={LABELS} items={ITEMS}>
      <HeaderMenu />
      <div className="cv-p-thread__scroll">
        <ParticipantTimeline items={ITEMS} labels={LABELS} resolveAttachmentUrl={() => Promise.resolve('')} />
      </div>
    </ParticipantMessageMenuProvider>,
  )
}

function fire(element: Element, type: string): void {
  act(() => element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })))
}

function item(container: HTMLElement, label: string): Element {
  return Array.from(container.querySelectorAll('[role="menuitem"]')).find((entry) => entry.textContent === label)!
}

describe('message info and conversation menu in a DOM', () => {
  it('shows who sent it, when, the delivery state and the read time; Escape closes', () => {
    const { container, unmount } = mount()
    fire(container.querySelector('.cv-p-message-menu__trigger')!, 'click')
    fire(item(container, 'Message info'), 'click')
    const panel = container.querySelector('[role="dialog"]')!
    expect(panel.getAttribute('aria-label')).toBe('Message info')
    expect(Array.from(panel.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      'From',
      'Sent',
      'Status',
      'Read',
    ])
    expect(panel.querySelectorAll('dd')[2]?.textContent).toBe(LABELS.statusRead)
    pressKey(document.body, 'Escape')
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    unmount()
  })

  it('enters selection mode with nothing checked from the header', () => {
    const { container, unmount } = mount()
    const trigger = container.querySelector('.cv-p-conversation-menu__trigger')!
    expect(trigger.getAttribute('aria-label')).toBe('Conversation options')
    fire(trigger, 'click')
    expect(
      Array.from(container.querySelectorAll('.cv-p-conversation-menu [role="menuitem"]')).map((e) => e.textContent),
    ).toEqual(['Select messages', 'Download conversation'])
    fire(item(container, 'Select messages'), 'click')
    expect(container.querySelector('[data-testid="selecting"]')?.textContent).toBe('on:0')
    unmount()
  })

  it('downloads the conversation as a text file named after the title', async () => {
    const saved: { name: string; blob: Blob | null } = { name: '', blob: null }
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    const originalClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = (blob: Blob) => {
      saved.blob = blob
      return 'blob:test'
    }
    URL.revokeObjectURL = () => undefined
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      saved.name = this.download
    }
    try {
      const { container, unmount } = mount()
      fire(container.querySelector('.cv-p-conversation-menu__trigger')!, 'click')
      fire(item(container, 'Download conversation'), 'click')
      expect(saved.name).toBe('Order 12.txt')
      const text = await saved.blob!.text()
      expect(text.startsWith('Order 12\n\n[')).toBe(true)
      expect(text).toContain(`${LABELS.me}: Mine`)
      unmount()
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
      HTMLAnchorElement.prototype.click = originalClick
    }
  })
})
