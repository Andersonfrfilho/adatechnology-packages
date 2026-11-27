/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Janelas das ações da lista: salvar como modelo, novo a partir de modelo e republicar.
 */

import type { Post, PostSummary } from '@adatechnology/content-contracts'
import { CopyPlus, FilePlus2, RefreshCw } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../lib/format'
import { useContentAdminApi, useContentText } from '../providers/ContentProvider'
import type { RenderDateTimeInput } from '../providers/types'
import { ActionDialog } from './ActionDialog'
import { DateTimeField } from './DateTimeField'

type DialogBaseProps = {
  readonly post: PostSummary
  readonly onClose: () => void
  readonly onDone: (post: Post) => void
}

function useAction(run: () => Promise<Post>, onDone: (post: Post) => void) {
  const { messages } = useContentText()
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  async function submit(): Promise<void> {
    setIsBusy(true)
    setError(undefined)
    try {
      onDone(await run())
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : messages.actionError)
      setIsBusy(false)
    }
  }
  return { isBusy, error, submit: () => void submit() }
}

type TitleDialogProps = DialogBaseProps & {
  readonly heading: string
  readonly fieldLabel: string
  readonly confirmLabel: string
  readonly icon: ReactNode
  readonly run: (title: string | undefined) => Promise<Post>
}

function TitleDialog({ post, heading, fieldLabel, confirmLabel, icon, run, onClose, onDone }: TitleDialogProps) {
  const [title, setTitle] = useState(post.title)
  const id = useId()
  const action = useAction(() => run(title.trim() || undefined), onDone)
  return (
    <ActionDialog
      title={heading}
      confirmLabel={confirmLabel}
      confirmIcon={icon}
      onClose={onClose}
      onConfirm={action.submit}
      isBusy={action.isBusy}
      error={action.error}
    >
      <div className="adc-field">
        <label htmlFor={id}>{fieldLabel}</label>
        <input id={id} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
      </div>
    </ActionDialog>
  )
}

export function SaveAsTemplateDialog(props: DialogBaseProps): ReactNode {
  const api = useContentAdminApi()
  const { messages } = useContentText()
  return (
    <TitleDialog
      {...props}
      heading={messages.saveAsTemplate}
      fieldLabel={messages.templateNameLabel}
      confirmLabel={messages.saveAsTemplate}
      icon={<CopyPlus aria-hidden="true" className="adc-icon" />}
      run={(title) =>
        api.saveAsTemplate
          ? api.saveAsTemplate(props.post.id, title ? { title } : {})
          : Promise.reject(new Error(messages.actionError))
      }
    />
  )
}

export function FromTemplateDialog(props: DialogBaseProps): ReactNode {
  const api = useContentAdminApi()
  const { messages } = useContentText()
  return (
    <TitleDialog
      {...props}
      heading={messages.newFromTemplate}
      fieldLabel={messages.newPostTitleLabel}
      confirmLabel={messages.createDraft}
      icon={<FilePlus2 aria-hidden="true" className="adc-icon" />}
      run={(title) =>
        api.createFromTemplate
          ? api.createFromTemplate(props.post.id, title ? { title } : {})
          : Promise.reject(new Error(messages.actionError))
      }
    />
  )
}

export function RepublishDialog({
  post,
  renderDateTimeInput,
  onClose,
  onDone,
}: DialogBaseProps & { readonly renderDateTimeInput?: RenderDateTimeInput | undefined }): ReactNode {
  const api = useContentAdminApi()
  const { messages } = useContentText()
  const [value, setValue] = useState(() => toDateTimeLocalValue(new Date().toISOString()))
  const id = useId()
  const action = useAction(() => {
    if (!api.republishPost) return Promise.reject(new Error(messages.actionError))
    const publishedAt = fromDateTimeLocalValue(value)
    return api.republishPost(post.id, publishedAt ? { publishedAt } : {})
  }, onDone)
  return (
    <ActionDialog
      title={messages.republish}
      confirmLabel={messages.republish}
      confirmIcon={<RefreshCw aria-hidden="true" className="adc-icon" />}
      onClose={onClose}
      onConfirm={action.submit}
      isBusy={action.isBusy}
      error={action.error}
    >
      <p className="adc-muted">{post.title}</p>
      <DateTimeField
        id={id}
        label={messages.republishDateLabel}
        value={value}
        onChange={setValue}
        renderDateTimeInput={renderDateTimeInput}
      />
      <p className="adc-hint">{messages.republishHint}</p>
    </ActionDialog>
  )
}
