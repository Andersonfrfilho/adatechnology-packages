import { describe, expect, it } from 'bun:test'

import {
  INITIAL_COPY_ANNOUNCEMENT,
  copyAnnouncementReducer,
  resolveLiveText,
  type CopyAnnouncementState,
} from './participantCopyAnnouncement'

function announce(state: CopyAnnouncementState, text: string): CopyAnnouncementState {
  return copyAnnouncementReducer(state, { type: 'announce', text })
}

describe('copy announcement', () => {
  it('changes the tick on every announcement, so a repeat restarts the timer', () => {
    const first = announce(INITIAL_COPY_ANNOUNCEMENT, 'Copied')
    const second = announce(first, 'Copied')
    expect(second.tick).not.toBe(first.tick)
    expect(copyAnnouncementReducer(second, { type: 'expired' }).text).toBe('')
  })

  it('renders two identical copies in a row as different region content', () => {
    const first = announce(INITIAL_COPY_ANNOUNCEMENT, 'Copied')
    const second = announce(first, 'Copied')
    const shown = (copy: CopyAnnouncementState): string =>
      resolveLiveText({ copy, notice: '', baselineNotice: undefined }).text
    expect(shown(first)).not.toBe(shown(second))
    expect(shown(first).replace('​', '')).toBe('Copied')
    expect(shown(second).replace('​', '')).toBe('Copied')
  })

  it('does not repeat an unchanged notice after the copy expires', () => {
    const copying = resolveLiveText({
      copy: announce(INITIAL_COPY_ANNOUNCEMENT, 'Copied'),
      notice: 'New messages',
      baselineNotice: undefined,
    })
    const expired = resolveLiveText({
      copy: { text: '', tick: 1 },
      notice: 'New messages',
      baselineNotice: copying.baselineNotice,
    })
    expect(expired.text).toBe('')
  })

  it('announces a notice that really changed, and the notice of a thread without copies', () => {
    const changed = resolveLiveText({ copy: { text: '', tick: 1 }, notice: 'New messages', baselineNotice: '' })
    expect(changed).toEqual({ text: 'New messages', baselineNotice: undefined })
    const plain = resolveLiveText({ copy: INITIAL_COPY_ANNOUNCEMENT, notice: 'New messages', baselineNotice: undefined })
    expect(plain.text).toBe('New messages')
  })
})
