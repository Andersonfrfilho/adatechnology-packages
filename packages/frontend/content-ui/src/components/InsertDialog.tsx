/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Pergunta o que a barra não sabe: URL e texto do link, ou URL, descrição e arquivo da imagem.
 * Fica dentro do `<form>` do editor, então o Enter é tratado aqui e não envia o formulário.
 */

import { useId, useState, type KeyboardEvent } from 'react'

import type { UploadImageResult } from '../hooks/usePostEditor'
import { isAbsoluteUrl } from '../lib/markdownFormat'
import { useContentText } from '../providers/ContentProvider'
import { FilePicker } from './FilePicker'

export type InsertDialogProps =
  | {
      readonly kind: 'link'
      readonly initialText: string
      readonly onSubmit: (values: { url: string; text: string }) => void
      readonly onClose: () => void
    }
  | {
      readonly kind: 'image'
      readonly initialText: string
      readonly isUploading: boolean
      readonly onUpload?: (file: File) => Promise<UploadImageResult>
      readonly onSubmit: (values: { url: string; alt: string }) => void
      readonly onClose: () => void
    }

export function InsertDialog(props: InsertDialogProps) {
  const { messages } = useContentText()
  const [url, setUrl] = useState('')
  const [text, setText] = useState(props.initialText)
  const [errorMessage, setErrorMessage] = useState('')
  const urlId = useId()
  const textId = useId()
  const isImage = props.kind === 'image'

  function submit(): void {
    if (!isAbsoluteUrl(url)) return setErrorMessage(messages.errorUrl)
    if (props.kind === 'image') props.onSubmit({ url: url.trim(), alt: text })
    else props.onSubmit({ url: url.trim(), text })
  }

  async function handlePick(file: File): Promise<void> {
    if (props.kind !== 'image' || !props.onUpload) return
    setErrorMessage('')
    const result = await props.onUpload(file)
    if ('error' in result) return setErrorMessage(messages[result.error])
    setUrl(result.url)
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation()
      props.onClose()
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div
      className="adc-popover adc-insert"
      role="dialog"
      aria-label={isImage ? messages.imageDialogTitle : messages.linkDialogTitle}
      onKeyDown={handleKeyDown}
    >
      {isImage && props.onUpload && (
        <FilePicker
          buttonLabel={props.isUploading ? messages.coverUploading : messages.imageUploadFromDevice}
          emptyLabel={messages.fileNoneChosen}
          accept="image/*"
          isBusy={props.isUploading}
          onPick={(file) => void handlePick(file)}
        />
      )}
      <div className="adc-field">
        <label htmlFor={urlId}>{isImage ? messages.fieldCoverUrl : messages.linkUrl}</label>
        <input
          id={urlId}
          type="url"
          autoFocus
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </div>
      <div className="adc-field">
        <label htmlFor={textId}>{isImage ? messages.fieldCoverAlt : messages.linkText}</label>
        <input id={textId} type="text" value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      <p className="adc-error" role="alert" hidden={!errorMessage}>
        {errorMessage}
      </p>
      <div className="adc-insert-actions">
        <button type="button" className="adc-button adc-button--ghost" onClick={props.onClose}>
          {messages.dialogCancel}
        </button>
        <button
          type="button"
          className="adc-button adc-button--primary"
          disabled={isImage && props.isUploading}
          onClick={submit}
        >
          {messages.dialogInsert}
        </button>
      </div>
    </div>
  )
}
