export class SpecTrack {
  stopCount = 0
  onended: (() => void) | null = null
  onmute: (() => void) | null = null
  onunmute: (() => void) | null = null
  stop(): void {
    this.stopCount += 1
  }
}

export class SpecStream {
  readonly track = new SpecTrack()
  getTracks(): SpecTrack[] {
    return [this.track]
  }
}

/** Follows the MediaRecorder spec: stop() makes state inactive at once; dataavailable and stop arrive later. */
export class SpecMediaRecorder {
  static instances: SpecMediaRecorder[] = []
  static chunkBytes = 4096
  static isTypeSupported(mimeType: string): boolean {
    return mimeType === 'audio/ogg;codecs=opus'
  }
  state: 'inactive' | 'recording' = 'inactive'
  stopCalls = 0
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    SpecMediaRecorder.instances.push(this)
  }
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    if (this.state === 'inactive') throw new DOMException('The MediaRecorder is already inactive', 'InvalidStateError')
    this.stopCalls += 1
    this.finishAsynchronously()
  }
  /** The user agent stops the recorder by itself (for example when the track ends). */
  autoStop(): void {
    this.finishAsynchronously()
  }
  private finishAsynchronously(): void {
    this.state = 'inactive'
    void Promise.resolve().then(() => {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(SpecMediaRecorder.chunkBytes)]) })
      this.onstop?.()
    })
  }
}
