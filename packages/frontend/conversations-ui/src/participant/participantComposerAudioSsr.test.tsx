import { afterEach, describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ParticipantComposer, type ParticipantComposerProps } from './ParticipantComposer'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { installFakeRecording, type FakeRecordingControls } from './participantRecorderFakes.test-helper'

const BASE: ParticipantComposerProps = {
  value: '',
  onChange: () => undefined,
  files: [],
  onFilesChange: () => undefined,
  onSend: () => undefined,
  labels: DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS,
  audioRecording: {},
  onSendAudio: () => undefined,
}

function render(overrides: Partial<ParticipantComposerProps> = {}): string {
  return renderToStaticMarkup(<ParticipantComposer {...BASE} {...overrides} />)
}

describe('the microphone in the composer (contract 2.2)', () => {
  let environment: FakeRecordingControls | undefined

  afterEach(() => {
    environment?.restore()
    environment = undefined
  })

  it('takes the place of send with the prop, an empty field and a recording browser', () => {
    environment = installFakeRecording()
    const markup = render()
    expect(markup).toContain('type="button" class="cv-p-button cv-p-button--primary cv-p-composer__record"')
    expect(markup).not.toContain('cv-p-composer__send')
  })

  it('never appears without the prop', () => {
    environment = installFakeRecording()
    const markup = render({ audioRecording: undefined })
    expect(markup).not.toContain('cv-p-composer__record')
    expect(markup).toContain('cv-p-composer__send')
  })

  it('gives way to send when there is text or an attached file', () => {
    environment = installFakeRecording()
    for (const overrides of [{ value: 'oi' }, { files: [new File(['x'], 'a.txt')] }]) {
      const markup = render(overrides)
      expect(markup).not.toContain('cv-p-composer__record')
      expect(markup).toContain('cv-p-composer__send')
    }
  })

  it('stays off when the browser cannot record', () => {
    expect(render()).not.toContain('cv-p-composer__record')
  })

  it('stays off on the portal channel: the channel only switches the microphone off', () => {
    environment = installFakeRecording()
    expect(render({ channel: 'portal' })).not.toContain('cv-p-composer__record')
  })

  it('stays off when the host accepts no audio type or gives no way to send it', () => {
    environment = installFakeRecording()
    expect(render({ acceptedTypes: ['image/*'] })).not.toContain('cv-p-composer__record')
    expect(render({ acceptedTypes: ['audio/*'] })).toContain('cv-p-composer__record')
    expect(render({ onSendAudio: undefined })).not.toContain('cv-p-composer__record')
  })

  it('is disabled together with the composer', () => {
    environment = installFakeRecording()
    expect(render({ disabled: true })).toMatch(/cv-p-composer__record"[^>]*disabled=""/)
  })
})
