import { describe, expect, it } from 'bun:test'

import { resolveCopyInteraction } from './messageTextCopyInteraction'

function buildKeyEvent(key: string): { key: string; preventDefault: () => void; wasPrevented: () => boolean } {
  let prevented = false
  return {
    key,
    preventDefault: () => {
      prevented = true
    },
    wasPrevented: () => prevented,
  }
}

describe('resolveCopyInteraction', () => {
  it('por padrão devolve só o onClick de cópia', () => {
    const onCopy = () => undefined
    const props = resolveCopyInteraction({ copyOnClick: true, accessibleCopy: false, onCopy })

    expect(props.onClick).toBe(onCopy)
    expect('role' in props).toBe(false)
    expect('tabIndex' in props).toBe(false)
    expect('onKeyDown' in props).toBe(false)
  })

  it('com copyOnClick desligado devolve objeto vazio, mesmo com accessibleCopy', () => {
    expect(resolveCopyInteraction({ copyOnClick: false, accessibleCopy: false, onCopy: () => undefined })).toEqual({})
    expect(resolveCopyInteraction({ copyOnClick: false, accessibleCopy: true, onCopy: () => undefined })).toEqual({})
  })

  it('com accessibleCopy expõe role, tabIndex e o onClick', () => {
    const onCopy = () => undefined
    const props = resolveCopyInteraction({ copyOnClick: true, accessibleCopy: true, onCopy })

    expect(props.role).toBe('button')
    expect(props.tabIndex).toBe(0)
    expect(props.onClick).toBe(onCopy)
  })

  it('Enter e Espaço copiam e previnem o default', () => {
    let copies = 0
    const props = resolveCopyInteraction({
      copyOnClick: true,
      accessibleCopy: true,
      onCopy: () => {
        copies += 1
      },
    })

    for (const key of ['Enter', ' ']) {
      const event = buildKeyEvent(key)
      props.onKeyDown?.(event)
      expect(event.wasPrevented()).toBe(true)
    }
    expect(copies).toBe(2)
  })

  it('outras teclas não copiam nem previnem o default', () => {
    let copies = 0
    const props = resolveCopyInteraction({
      copyOnClick: true,
      accessibleCopy: true,
      onCopy: () => {
        copies += 1
      },
    })
    const event = buildKeyEvent('Tab')

    props.onKeyDown?.(event)

    expect(copies).toBe(0)
    expect(event.wasPrevented()).toBe(false)
  })
})
