export type FakeRecordingControls = {
  chunkBytes: number
  readonly restore: () => void
}

class FakeTrack {
  onended: (() => void) | null = null
  onmute: (() => void) | null = null
  onunmute: (() => void) | null = null
  stop(): void {}
}

class FakeStream {
  getTracks(): FakeTrack[] {
    return [new FakeTrack()]
  }
}

/** Installs a MediaRecorder and getUserMedia that record `controls.chunkBytes` bytes on stop. */
export function installFakeRecording(initialChunkBytes = 4096): FakeRecordingControls {
  const globals = globalThis as Record<string, unknown>
  const navigatorObject = globalThis.navigator as unknown as Record<string, unknown>
  const previousRecorder = globals.MediaRecorder
  const previousMediaDevices = navigatorObject.mediaDevices
  const controls: FakeRecordingControls = {
    chunkBytes: initialChunkBytes,
    restore: () => {
      globals.MediaRecorder = previousRecorder
      navigatorObject.mediaDevices = previousMediaDevices
    },
  }
  globals.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported(mimeType: string): boolean {
      return mimeType === 'audio/ogg;codecs=opus'
    }
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    start(): void {}
    stop(): void {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(controls.chunkBytes)]) })
      this.onstop?.()
    }
  }
  navigatorObject.mediaDevices = { getUserMedia: async () => new FakeStream() }
  return controls
}
