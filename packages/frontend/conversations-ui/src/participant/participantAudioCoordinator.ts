export type AudioPlaybackHandle = { readonly pause: () => void }

let activeHandle: AudioPlaybackHandle | undefined

/** One audio at a time on the page: whoever starts pauses the previous one. No provider, no context. */
export function claimAudioPlayback(handle: AudioPlaybackHandle): void {
  if (activeHandle && activeHandle !== handle) activeHandle.pause()
  activeHandle = handle
}

export function releaseAudioPlayback(handle: AudioPlaybackHandle): void {
  if (activeHandle === handle) activeHandle = undefined
}
