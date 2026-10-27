type MediaState = {
  paused: boolean
  currentTime: number
  duration: number
  defaultPlaybackRate: number
  playbackRate: number
}

export type FakeMediaControls = {
  /** Elements in the order `play()` was called on them. */
  readonly playCalls: HTMLMediaElement[]
  readonly pauseCalls: HTMLMediaElement[]
  /** What the next `play()` promises: the iOS gesture refusal is a rejection. */
  playOutcome: 'resolve' | 'reject'
  readonly stateOf: (audio: HTMLMediaElement) => MediaState
  readonly emit: (audio: HTMLMediaElement, type: string) => void
  readonly restore: () => void
}

const OVERRIDDEN = ['paused', 'currentTime', 'duration', 'defaultPlaybackRate', 'playbackRate', 'play', 'pause', 'load'] as const

/** Replaces the HTMLMediaElement members the player uses with an in-memory media element. */
export function installFakeMedia(): FakeMediaControls {
  const prototype = HTMLMediaElement.prototype
  const previous = OVERRIDDEN.map((name) => [name, Object.getOwnPropertyDescriptor(prototype, name)] as const)
  const states = new WeakMap<object, MediaState>()
  const stateOf = (audio: HTMLMediaElement): MediaState => {
    const existing = states.get(audio)
    if (existing) return existing
    const created: MediaState = { paused: true, currentTime: 0, duration: Number.NaN, defaultPlaybackRate: 1, playbackRate: 1 }
    states.set(audio, created)
    return created
  }
  const emit = (audio: HTMLMediaElement, type: string): void => {
    audio.dispatchEvent(new Event(type))
  }
  const controls: FakeMediaControls = {
    playCalls: [],
    pauseCalls: [],
    playOutcome: 'resolve',
    stateOf,
    emit,
    restore: () => {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(prototype, name, descriptor)
        else delete (prototype as unknown as Record<string, unknown>)[name]
      }
    },
  }
  for (const name of ['paused', 'currentTime', 'duration', 'defaultPlaybackRate', 'playbackRate'] as const) {
    Object.defineProperty(prototype, name, {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this)[name]
      },
      set(this: HTMLMediaElement, value: never) {
        ;(stateOf(this) as Record<string, unknown>)[name] = value
      },
    })
  }
  Object.defineProperty(prototype, 'play', {
    configurable: true,
    value(this: HTMLMediaElement): Promise<void> {
      controls.playCalls.push(this)
      if (controls.playOutcome === 'reject') return Promise.reject(new Error('NotAllowedError'))
      stateOf(this).paused = false
      emit(this, 'play')
      return Promise.resolve()
    },
  })
  Object.defineProperty(prototype, 'pause', {
    configurable: true,
    value(this: HTMLMediaElement): void {
      if (stateOf(this).paused) return
      controls.pauseCalls.push(this)
      stateOf(this).paused = true
      emit(this, 'pause')
    },
  })
  Object.defineProperty(prototype, 'load', { configurable: true, value: () => undefined })
  return controls
}
