import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { act, useRef } from 'react'

import { setupDom, wait, type DomHarness } from './domHarness.test-helper'
import { TooltipLayer } from './Tooltip'
import { useSuppressTouchTooltips } from './participant/useSuppressTouchTooltips'

let harness: DomHarness

beforeAll(async () => {
  harness = await setupDom()
})
afterAll(() => harness.teardown())

function hover(target: Element): void {
  act(() => void target.dispatchEvent(new Event('pointerover', { bubbles: true })))
}

function balloons(): number {
  return document.body.querySelectorAll('[role="tooltip"]').length
}

function Target() {
  return <button type="button" data-cv-tooltip="Hint">x</button>
}

describe('TooltipLayer ownership', () => {
  it('draws one balloon with two layers, and keeps drawing after the owner unmounts', async () => {
    const first = harness.mount(<TooltipLayer />)
    harness.mount(<TooltipLayer />)
    const target = harness.mount(<Target />).container.querySelector('button')!

    hover(target)
    await wait(200)
    expect(balloons()).toBe(1)

    first.unmount()
    act(() => void target.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    hover(target)
    await wait(200)
    expect(balloons()).toBe(1)
  })
})

function Thread() {
  const rootRef = useRef<HTMLDivElement>(null)
  useSuppressTouchTooltips(rootRef)
  return (
    <div ref={rootRef}>
      <Target />
    </div>
  )
}

describe('touch on the participant thread', () => {
  it('does not light the balloon when a tap focuses the button', async () => {
    harness.mount(<TooltipLayer />)
    const button = harness.mount(<Thread />).container.querySelector('button')!

    act(() => void button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })))
    act(() => void button.dispatchEvent(new Event('focusin', { bubbles: true })))
    await wait(200)

    expect(balloons()).toBe(0)
  })

  it('still shows it for keyboard focus after a touch', async () => {
    harness.mount(<TooltipLayer />)
    const button = harness.mount(<Thread />).container.querySelector('button')!

    act(() => void button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })))
    act(() => void button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    act(() => void button.dispatchEvent(new Event('focusin', { bubbles: true })))
    await wait(200)

    expect(balloons()).toBe(1)
  })
})
