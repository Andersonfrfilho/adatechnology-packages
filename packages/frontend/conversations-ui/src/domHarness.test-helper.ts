import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { act, type ReactElement } from 'react'
import type { Root } from 'react-dom/client'

export type MountedTree = {
  readonly container: HTMLElement
  readonly unmount: () => void
}

export type DomHarness = {
  readonly mount: (element: ReactElement) => MountedTree
  readonly teardown: () => void
}

/**
 * Registers happy-dom for one test file only and mounts React trees into it. react-dom/client is
 * imported after the registration because it reads the DOM globals when it loads.
 */
export async function setupDom(): Promise<DomHarness> {
  GlobalRegistrator.register()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const { createRoot } = await import('react-dom/client')
  const roots: Root[] = []

  function mount(element: ReactElement): MountedTree {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(element))
    return { container, unmount: () => act(() => root.unmount()) }
  }

  function teardown(): void {
    for (const root of roots) act(() => root.unmount())
    document.body.innerHTML = ''
    GlobalRegistrator.unregister()
  }

  return { mount, teardown }
}

export function pressKey(target: Element, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

export function wait(milliseconds: number): Promise<void> {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds))
  })
}
