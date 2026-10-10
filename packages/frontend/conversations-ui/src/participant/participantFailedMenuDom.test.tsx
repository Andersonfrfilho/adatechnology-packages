import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { act } from 'react'

import { setupDom, pressKey, type DomHarness } from '../domHarness.test-helper'
import { ParticipantFailedMenu } from './ParticipantFailedMenu'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS as LABELS } from './participantLabels'

let harness: DomHarness

beforeAll(async () => {
  harness = await setupDom()
})
afterAll(() => harness.teardown())

const noop = (): void => undefined

function mountMenu() {
  const tree = harness.mount(
    <div className="cv-p-thread__scroll">
      <div className="cv-p-bubble">
        <ParticipantFailedMenu labels={LABELS} onEdit={noop} onDiscard={noop} />
      </div>
    </div>,
  )
  const trigger = tree.container.querySelector<HTMLButtonElement>('.cv-p-failed-menu__trigger')!
  return { ...tree, trigger }
}

function click(element: Element): void {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function items(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'))
}

describe('failed menu in a DOM', () => {
  it('opens on click, names the menu by the trigger and focuses the first item', () => {
    const { container, trigger } = mountMenu()
    click(trigger)

    const menu = container.querySelector('[role="menu"]')!
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(document.activeElement).toBe(items(container)[0])
    expect(items(container).every((item) => item.tabIndex === -1)).toBe(true)
    expect(trigger.hasAttribute('data-cv-tooltip')).toBe(false)
  })

  it('ArrowUp on the trigger opens the menu on the last item', () => {
    const { container, trigger } = mountMenu()
    act(() => trigger.focus())
    pressKey(trigger, 'ArrowUp')

    expect(document.activeElement).toBe(items(container)[1])
  })

  it('Escape closes, gives the focus back to the trigger and does not reach the host', () => {
    const { container, trigger } = mountMenu()
    click(trigger)
    let hostSawEscape = false
    const hostListener = (): void => void (hostSawEscape = true)
    document.addEventListener('keydown', hostListener)

    pressKey(items(container)[0]!, 'Escape')
    document.removeEventListener('keydown', hostListener)

    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(hostSawEscape).toBe(false)
  })

  it('Tab closes the menu without pulling the focus back to the trigger', () => {
    const { container, trigger } = mountMenu()
    click(trigger)
    pressKey(items(container)[0]!, 'Tab')

    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).not.toBe(trigger)
  })

  it('closes on a pointer press outside and keeps open on one inside', () => {
    const { container, trigger } = mountMenu()
    click(trigger)
    act(() => void items(container)[0]!.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()

    act(() => void document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('removes its document listener when unmounted with the menu open', () => {
    const added: string[] = []
    const removed: string[] = []
    const add = document.addEventListener.bind(document)
    const remove = document.removeEventListener.bind(document)
    document.addEventListener = ((type: string, ...rest: unknown[]) => {
      added.push(type)
      return (add as (...args: unknown[]) => void)(type, ...rest)
    }) as typeof document.addEventListener
    document.removeEventListener = ((type: string, ...rest: unknown[]) => {
      removed.push(type)
      return (remove as (...args: unknown[]) => void)(type, ...rest)
    }) as typeof document.removeEventListener

    const { unmount, trigger } = mountMenu()
    click(trigger)
    unmount()
    document.addEventListener = add
    document.removeEventListener = remove

    expect(added.filter((type) => type === 'pointerdown')).toHaveLength(1)
    expect(removed.filter((type) => type === 'pointerdown')).toHaveLength(1)
    expect(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))).not.toThrow()
  })
})

describe('failed menu placement in a DOM', () => {
  const original = Element.prototype.getBoundingClientRect

  function stubLayout(bubbleTop: number): void {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const top = this.classList.contains('cv-p-thread__scroll') ? 100 : this.classList.contains('cv-p-bubble') ? bubbleTop : 0
      const height = this.getAttribute('role') === 'menu' ? 90 : 20
      return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) }
    }
  }

  it('flips below when the bubble is the first of the conversation', () => {
    stubLayout(108)
    const { container, trigger } = mountMenu()
    click(trigger)
    Element.prototype.getBoundingClientRect = original

    expect(container.querySelector('.cv-p-failed-menu__list--below')).not.toBeNull()
  })

  it('stays above when there is room', () => {
    stubLayout(500)
    const { container, trigger } = mountMenu()
    click(trigger)
    Element.prototype.getBoundingClientRect = original

    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    expect(container.querySelector('.cv-p-failed-menu__list--below')).toBeNull()
  })
})
