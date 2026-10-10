import { useState, type ChangeEvent, type FormEvent } from 'react'

import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'
import { formatFileSize } from '../lib/format'
import type { QuickReply } from '../quickReplies/quickReply.types'
import { AttachControl, MessageField, SendButton } from './ParticipantComposerControls'
import { maxBytesForChannel, reduceFilesSelection, type ParticipantFileRejection } from './participantFileValidation'
import type { ParticipantConversationsLabels } from './participantLabels'
import { applyQuickReply } from './participantQuickReply'

export type ParticipantComposerProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly files: readonly File[]
  readonly onFilesChange: (files: readonly File[]) => void
  readonly onSend: () => void
  readonly labels: ParticipantConversationsLabels
  /** Absent means the `app` channel. */
  readonly channel?: ConversationChannel
  readonly disabled?: boolean
  /** Blocks only the send button: the field stays editable while a send is in flight. */
  readonly isSending?: boolean
  readonly maxLength?: number
  /** MIME types or wildcards offered to the file picker and enforced before sending. */
  readonly acceptedTypes?: readonly string[]
  /** Tapping a chip fills the text; it never sends. Absent or empty means no strip. */
  readonly quickReplies?: readonly QuickReply[]
}

type QuickReplyStripProps = {
  readonly quickReplies: readonly QuickReply[]
  readonly labels: ParticipantConversationsLabels
  readonly onPick: (body: string) => void
}

function QuickReplyStrip({ quickReplies, labels, onPick }: QuickReplyStripProps) {
  return (
    <div className="cv-p-quick" role="group" aria-label={labels.quickRepliesGroup}>
      {quickReplies.map((quickReply) => (
        <button key={quickReply.id} type="button" className="cv-p-chip" onClick={() => onPick(quickReply.body)}>
          {quickReply.title}
        </button>
      ))}
    </div>
  )
}

type FileListProps = {
  readonly files: readonly File[]
  readonly labels: ParticipantConversationsLabels
  readonly onRemove: (file: File) => void
}

function FileList({ files, labels, onRemove }: FileListProps) {
  if (files.length === 0) return null
  return (
    <ul className="cv-p-files" aria-label={labels.attachmentsList}>
      {files.map((file, index) => (
        <li key={`${file.name}-${file.size}-${index}`} className="cv-p-files__item">
          <span className="cv-p-files__name">{file.name}</span>
          <span className="cv-p-files__size">{formatFileSize(file.size)}</span>
          <button type="button" className="cv-p-files__remove" aria-label={`${labels.removeAttachment}: ${file.name}`} data-cv-tooltip={labels.removeAttachment} onClick={() => onRemove(file)}>
            <span aria-hidden="true">×</span>
            <span className="cv-p-sr-only">{labels.removeAttachment}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function rejectionText(rejection: ParticipantFileRejection, labels: ParticipantConversationsLabels): string {
  return rejection === 'tooLarge' ? labels.attachmentTooLarge : labels.attachmentTypeNotAccepted
}

function useFileSelection(props: ParticipantComposerProps) {
  const [rejection, setRejection] = useState<ParticipantFileRejection | undefined>(undefined)
  const { files, onFilesChange, channel } = props
  const maxBytes = maxBytesForChannel(channel)

  function handleFilesChosen(event: ChangeEvent<HTMLInputElement>): void {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    const result = reduceFilesSelection({ current: files, incoming: chosen, maxBytes, acceptedTypes: props.acceptedTypes })
    setRejection(result.rejected[0]?.reason)
    if (result.files.length !== files.length) onFilesChange(result.files)
  }

  function handleRemoveFile(file: File): void {
    setRejection(undefined)
    onFilesChange(files.filter((current) => current !== file))
  }

  return { rejection, handleFilesChosen, handleRemoveFile }
}

export function ParticipantComposer(props: ParticipantComposerProps) {
  const { value, onChange, files, onSend, labels, channel = 'app', disabled = false, isSending = false } = props
  const { rejection, handleFilesChosen, handleRemoveFile } = useFileSelection(props)
  const canSend = !disabled && !isSending && (value.trim().length > 0 || files.length > 0)

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (canSend) onSend()
  }

  return (
    <form className="cv-p-composer" onSubmit={handleSubmit}>
      {props.quickReplies && props.quickReplies.length > 0 ? (
        <QuickReplyStrip quickReplies={props.quickReplies} labels={labels} onPick={(body) => onChange(applyQuickReply(value, body))} />
      ) : null}
      <FileList files={files} labels={labels} onRemove={handleRemoveFile} />
      {rejection ? (
        <p className="cv-p-composer__error" role="alert">
          {rejectionText(rejection, labels)}
        </p>
      ) : null}
      <div className="cv-p-composer__row">
        {channelCapabilityFor(channel).attachments.accepted ? (
          <AttachControl labels={labels} disabled={disabled} acceptedTypes={props.acceptedTypes} onChosen={handleFilesChosen} />
        ) : null}
        <MessageField
          value={value}
          label={labels.messageInputLabel}
          placeholder={labels.messageInputPlaceholder}
          disabled={disabled}
          maxLength={props.maxLength}
          onChange={onChange}
        />
        <SendButton label={labels.send} disabled={!canSend} />
      </div>
    </form>
  )
}
