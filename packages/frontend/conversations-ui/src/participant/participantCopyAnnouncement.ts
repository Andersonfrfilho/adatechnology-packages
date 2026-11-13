export type CopyAnnouncementState = { readonly text: string; readonly tick: number }

export type CopyAnnouncementAction = { readonly type: 'announce'; readonly text: string } | { readonly type: 'expired' }

export const INITIAL_COPY_ANNOUNCEMENT: CopyAnnouncementState = { text: '', tick: 0 }

const REPEAT_MARKER = '​'

/** The tick changes on every announcement so a repeat inside the window restarts the timer. */
export function copyAnnouncementReducer(
  state: CopyAnnouncementState,
  action: CopyAnnouncementAction,
): CopyAnnouncementState {
  if (action.type === 'announce') return { text: action.text, tick: state.tick + 1 }
  return { ...state, text: '' }
}

export type LiveTextResolution = {
  readonly text: string
  /** The notice that was already spoken when the copy took over the region; undefined while it is not suppressed. */
  readonly baselineNotice: string | undefined
}

/** A zero-width character alternates so identical consecutive announcements still change the region. */
export function resolveLiveText(params: {
  readonly copy: CopyAnnouncementState
  readonly notice: string
  readonly baselineNotice: string | undefined
}): LiveTextResolution {
  const { copy, notice, baselineNotice } = params
  if (copy.text !== '') {
    const marker = copy.tick % 2 === 0 ? REPEAT_MARKER : ''
    return { text: `${copy.text}${marker}`, baselineNotice: baselineNotice ?? notice }
  }
  if (baselineNotice !== undefined && baselineNotice === notice) return { text: '', baselineNotice }
  return { text: notice, baselineNotice: undefined }
}
