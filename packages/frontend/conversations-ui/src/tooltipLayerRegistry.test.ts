import { describe, expect, it } from 'bun:test'

import { createTooltipLayerRegistry } from './tooltipLayerRegistry'

function track() {
  const events: boolean[] = []
  return { events, notify: (isOwner: boolean) => void events.push(isOwner) }
}

describe('createTooltipLayerRegistry', () => {
  it('makes the first mounted layer the owner and keeps the others quiet', () => {
    const registry = createTooltipLayerRegistry()
    const first = track()
    const second = track()
    registry.register({}, first.notify)
    registry.register({}, second.notify)

    expect(first.events).toEqual([true])
    expect(second.events).toEqual([])
  })

  it('hands the ownership to the next mounted layer when the owner unmounts', () => {
    const registry = createTooltipLayerRegistry()
    const first = track()
    const second = track()
    const third = track()
    const unmountFirst = registry.register({}, first.notify)
    registry.register({}, second.notify)
    registry.register({}, third.notify)

    unmountFirst()

    expect(second.events).toEqual([true])
    expect(third.events).toEqual([])
  })

  it('does not disturb the owner when a waiting layer unmounts', () => {
    const registry = createTooltipLayerRegistry()
    const first = track()
    const second = track()
    registry.register({}, first.notify)
    registry.register({}, second.notify)()

    expect(first.events).toEqual([true])
    expect(second.events).toEqual([])
  })

  it('lets a layer mounted after everyone left become the owner again', () => {
    const registry = createTooltipLayerRegistry()
    registry.register({}, () => undefined)()
    const late = track()
    registry.register({}, late.notify)

    expect(late.events).toEqual([true])
  })
})
