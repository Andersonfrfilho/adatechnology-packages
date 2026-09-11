import { useCallback, useEffect, useRef, useState } from 'react'
import { filterQuickReplies } from './quickReplySearch'
import { mapWithConcurrencyLimit, moveAttachment, validateAttachmentFiles } from './quickReplyAttachmentUpload'
import type { QuickReply, QuickReplyAttachment, QuickReplyInput } from './quickReply.types'
import type { QuickRepliesWorkspaceLabels } from './labels'

/**
 * Portas que a tela de cadastro precisa. `create`/`update`/`delete` ausentes não impedem a leitura
 * — só tiram a ação correspondente, a mesma regra de capacidade do resto do pacote.
 */
export interface QuickRepliesWorkspaceApi {
  readonly listQuickReplies?: (params?: { search?: string }) => Promise<QuickReply[]>
  readonly createQuickReply?: (input: QuickReplyInput) => Promise<QuickReply>
  readonly updateQuickReply?: (id: string, input: QuickReplyInput) => Promise<QuickReply>
  readonly deleteQuickReply?: (id: string) => Promise<void>
  /** Sem esta porta, a seção de anexos não aparece — nem no formulário. */
  readonly uploadQuickReplyAttachment?: (
    file: File,
    options?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
  ) => Promise<QuickReplyAttachment>
}

export type QuickReplyFormField = 'title' | 'shortcut' | 'body'
export type QuickRepliesWorkspaceFieldErrors = Partial<Record<QuickReplyFormField, string>>

export type QuickRepliesWorkspaceEditing = {
  /** `null` é a criação; presente é edição do registro com este id. */
  readonly id: string | null
  readonly title: string
  readonly shortcut: string
  readonly body: string
  /** Já subidos — a ordem daqui é a ordem de envio salva (QR-30). */
  readonly attachments: readonly QuickReplyAttachment[]
}

/** Item em upload no formulário: estado local, nunca persistido — some ao terminar ou ser removido. */
export type PendingAttachmentUpload = {
  readonly localId: string
  readonly file: File
  readonly status: 'uploading' | 'processing' | 'error'
  readonly progress: number
  readonly error?: string
}

const TITLE_MAX_LENGTH = 40
const BODY_MAX_LENGTH = 1000
const SHORTCUT_PATTERN = /^[a-z0-9-]{1,20}$/

/** Casca genérica de erro de API com `code` e `details[]` (`apis.md`) — sem acoplar a um cliente HTTP específico. */
type ApiErrorShape = { readonly code?: unknown; readonly details?: unknown }

/**
 * Desembrulha a casca `{ code, details }` de onde quer que o cliente HTTP do host a tenha
 * pendurado. `apis.md` define o envelope `{ error: { code, message, details } }`, mas cada cliente
 * (fetch cru, axios, o `Error` que o `ConversationsProvider` relança) expõe o objeto lançado de um
 * jeito diferente — `error.error`, `error.response.data.error` (axios) ou `error.body.error`
 * (alguns wrappers de fetch). Sem isto, a rejeição real do servidor nunca chega ao formulário e o
 * operador só vê "não foi possível salvar", mesmo quando a API já mandou o campo certo.
 */
const MAX_ERROR_ENVELOPE_DEPTH = 3

/**
 * Desce no máximo `MAX_ERROR_ENVELOPE_DEPTH` níveis: um erro que se referencia (`error.error ===
 * error`, comum em `Error` customizado com `cause` circular) faria a recursão nunca terminar.
 */
function apiErrorEnvelopeOf(error: unknown, depth = 0): ApiErrorShape | undefined {
  if (depth >= MAX_ERROR_ENVELOPE_DEPTH) return undefined
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as Record<string, unknown>
  if ('code' in candidate || 'details' in candidate) return candidate as ApiErrorShape
  const nested =
    (candidate.error as unknown) ??
    (candidate.response as Record<string, unknown> | undefined)?.data ??
    (candidate.body as unknown)
  if (nested && typeof nested === 'object') return apiErrorEnvelopeOf(nested, depth + 1)
  return undefined
}

function fieldErrorsOf(error: unknown): QuickRepliesWorkspaceFieldErrors {
  const envelope = apiErrorEnvelopeOf(error)
  if (!envelope) return {}
  const details = envelope.details
  if (!Array.isArray(details)) return {}
  const result: QuickRepliesWorkspaceFieldErrors = {}
  for (const detail of details) {
    if (!detail || typeof detail !== 'object') continue
    const field = (detail as { field?: unknown }).field
    const message = (detail as { message?: unknown }).message
    if (typeof field === 'string' && typeof message === 'string' && isFormField(field)) {
      result[field] = message
    }
  }
  return result
}

function isFormField(value: string): value is QuickReplyFormField {
  return value === 'title' || value === 'shortcut' || value === 'body'
}

function errorCodeOf(error: unknown): string | undefined {
  const code = apiErrorEnvelopeOf(error)?.code
  return typeof code === 'string' ? code : undefined
}

/** Regras de formato — as mesmas do backend (`QR-08`), verificadas antes de gastar uma chamada. */
export function validateQuickReplyInput(
  input: QuickReplyInput,
  labels: QuickRepliesWorkspaceLabels,
): QuickRepliesWorkspaceFieldErrors {
  const errors: QuickRepliesWorkspaceFieldErrors = {}
  if (!input.title.trim() || input.title.length > TITLE_MAX_LENGTH) errors.title = labels.fieldTitleInvalid
  if (!SHORTCUT_PATTERN.test(input.shortcut)) errors.shortcut = labels.fieldShortcutInvalid
  if (!input.body.trim() || input.body.length > BODY_MAX_LENGTH) errors.body = labels.fieldBodyInvalid
  return errors
}

export type SubmitQuickReplyParams = {
  readonly api: QuickRepliesWorkspaceApi
  readonly editing: QuickRepliesWorkspaceEditing
  readonly labels: QuickRepliesWorkspaceLabels
}

export type SubmitQuickReplyResult =
  | { readonly outcome: 'saved'; readonly quickReply: QuickReply }
  | { readonly outcome: 'invalid'; readonly fieldErrors: QuickRepliesWorkspaceFieldErrors }
  | {
      readonly outcome: 'rejected'
      readonly fieldErrors: QuickRepliesWorkspaceFieldErrors
      readonly formError?: string
    }

/**
 * Toda a lógica de salvar num único lugar testável sem montar o hook: valida, chama a porta certa
 * (criar ou atualizar) e traduz a rejeição — 409 com `code: 'QUICK_REPLY_SHORTCUT_TAKEN'` ou
 * `error.details[]` — no campo que errou.
 */
export async function submitQuickReply({
  api,
  editing,
  labels,
}: SubmitQuickReplyParams): Promise<SubmitQuickReplyResult> {
  const input: QuickReplyInput = {
    title: editing.title.trim(),
    shortcut: editing.shortcut.trim(),
    body: editing.body,
    // Só manda a lista quando o host oferece a porta de upload — ausente, `attachmentUploadIds`
    // some do payload e o backend não mexe nos anexos já gravados (contrato do tipo).
    ...(api.uploadQuickReplyAttachment
      ? { attachmentUploadIds: editing.attachments.map((attachment) => attachment.uploadId) }
      : {}),
  }
  const validationErrors = validateQuickReplyInput(input, labels)
  if (Object.keys(validationErrors).length > 0) return { outcome: 'invalid', fieldErrors: validationErrors }

  const editingId = editing.id
  if (editingId === null && !api.createQuickReply) {
    return { outcome: 'rejected', fieldErrors: {}, formError: labels.saveUnavailable }
  }
  if (editingId !== null && !api.updateQuickReply) {
    return { outcome: 'rejected', fieldErrors: {}, formError: labels.saveUnavailable }
  }
  const save =
    editingId === null
      ? (api.createQuickReply as NonNullable<QuickRepliesWorkspaceApi['createQuickReply']>)
      : (input: QuickReplyInput) =>
          (api.updateQuickReply as NonNullable<QuickRepliesWorkspaceApi['updateQuickReply']>)(editingId, input)

  try {
    const quickReply = await save(input)
    if (!quickReply) return { outcome: 'invalid', fieldErrors: {} }
    return { outcome: 'saved', quickReply }
  } catch (caught: unknown) {
    const detailErrors = fieldErrorsOf(caught)
    const code = errorCodeOf(caught)
    const shortcutMessage =
      detailErrors.shortcut ?? (code === 'QUICK_REPLY_SHORTCUT_TAKEN' ? labels.shortcutTaken : undefined)
    if (shortcutMessage || Object.keys(detailErrors).length > 0) {
      return {
        outcome: 'rejected',
        fieldErrors: { ...detailErrors, ...(shortcutMessage ? { shortcut: shortcutMessage } : {}) },
      }
    }
    // Nunca `caught.message` cru: é texto de exceção interna (rede, parsing), não algo que o
    // operador deva ler — a mensagem exibida é sempre o rótulo do host (QR-10).
    return {
      outcome: 'rejected',
      fieldErrors: {},
      formError: labels.saveError,
    }
  }
}

export type InsertAtCursorResult = {
  readonly text: string
  readonly caret: number
}

/** Insere `marker` na posição do cursor (ou troca a seleção) — usado pelo botão "Inserir variável". */
export function insertAtCursor(text: string, start: number, end: number, marker: string): InsertAtCursorResult {
  return { text: text.slice(0, start) + marker + text.slice(end), caret: start + marker.length }
}

export type UseQuickRepliesWorkspaceParams = {
  readonly api: QuickRepliesWorkspaceApi
  readonly labels: QuickRepliesWorkspaceLabels
}

export type UseQuickRepliesWorkspaceResult = {
  readonly quickReplies: readonly QuickReply[]
  readonly filtered: readonly QuickReply[]
  readonly isLoading: boolean
  readonly loadError: string | undefined
  readonly search: string
  readonly setSearch: (value: string) => void
  /** Sem `createQuickReply`, a tela só mostra a tabela — nada de criar, editar ou excluir. */
  readonly readOnly: boolean
  readonly canEdit: boolean
  readonly canDelete: boolean
  readonly editing: QuickRepliesWorkspaceEditing | undefined
  readonly startCreate: () => void
  readonly startEdit: (quickReply: QuickReply) => void
  readonly cancelEdit: () => void
  readonly updateField: (field: QuickReplyFormField, value: string) => void
  readonly fieldErrors: QuickRepliesWorkspaceFieldErrors
  readonly isSaving: boolean
  readonly saveError: string | undefined
  readonly submit: () => Promise<void>
  readonly remove: (id: string) => Promise<void>
  /** Excluindo agora — para o botão da linha mostrar o spinner certo (QR-47). */
  readonly deletingId: string | undefined
  /** Sem `uploadQuickReplyAttachment`, a seção de anexos não aparece no formulário (QR-31). */
  readonly hasAttachmentsCapability: boolean
  readonly pendingUploads: readonly PendingAttachmentUpload[]
  readonly addAttachmentFiles: (files: FileList | readonly File[]) => void
  readonly retryAttachmentUpload: (localId: string) => void
  readonly cancelAttachmentUpload: (localId: string) => void
  readonly removeAttachment: (uploadId: string) => void
  readonly moveAttachmentAt: (index: number, direction: -1 | 1) => void
  readonly attachmentRejections: readonly { readonly file: File; readonly reason: 'limit' | 'size' }[]
  readonly dismissAttachmentRejections: () => void
}

/** Estado da tela de cadastro: lista, busca, formulário de criação/edição, anexos e exclusão. */
export function useQuickRepliesWorkspace({
  api,
  labels,
}: UseQuickRepliesWorkspaceParams): UseQuickRepliesWorkspaceResult {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<QuickRepliesWorkspaceEditing | undefined>(undefined)
  const [fieldErrors, setFieldErrors] = useState<QuickRepliesWorkspaceFieldErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined)
  const [pendingUploads, setPendingUploads] = useState<readonly PendingAttachmentUpload[]>([])
  const [attachmentRejections, setAttachmentRejections] = useState<
    readonly { readonly file: File; readonly reason: 'limit' | 'size' }[]
  >([])
  /** Um `AbortController` por upload em voo — a única forma de cancelar de verdade um `fetch` preso. */
  const uploadControllersRef = useRef<Record<string, AbortController>>({})

  useEffect(() => {
    if (!api.listQuickReplies) return
    let cancelled = false
    setIsLoading(true)
    setLoadError(undefined)
    api
      .listQuickReplies()
      .then((result) => {
        if (!cancelled) setQuickReplies(result)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadError(caught instanceof Error ? caught.message : labels.failure)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api.listQuickReplies])

  const filtered = filterQuickReplies({ quickReplies, search })

  /** Cancela todo upload em voo — trocar de registro sem isso deixaria um `fetch` órfão terminando
   * sozinho e tentando atualizar um estado que já não existe mais. */
  const abortAllUploads = useCallback(() => {
    for (const controller of Object.values(uploadControllersRef.current)) controller.abort()
    uploadControllersRef.current = {}
    setPendingUploads([])
  }, [])

  const startCreate = useCallback(() => {
    abortAllUploads()
    setAttachmentRejections([])
    setEditing({ id: null, title: '', shortcut: '', body: '', attachments: [] })
    setFieldErrors({})
    setSaveError(undefined)
  }, [abortAllUploads])

  const startEdit = useCallback(
    (quickReply: QuickReply) => {
      abortAllUploads()
      setAttachmentRejections([])
      setEditing({
        id: quickReply.id,
        title: quickReply.title,
        shortcut: quickReply.shortcut,
        body: quickReply.body,
        attachments: quickReply.attachments ?? [],
      })
      setFieldErrors({})
      setSaveError(undefined)
    },
    [abortAllUploads],
  )

  const cancelEdit = useCallback(() => {
    abortAllUploads()
    setAttachmentRejections([])
    setEditing(undefined)
    setFieldErrors({})
    setSaveError(undefined)
  }, [abortAllUploads])

  const updateField = useCallback((field: QuickReplyFormField, value: string) => {
    setEditing((current) => (current ? { ...current, [field]: value } : current))
    // Editar o campo limpa o erro dele — a mensagem antiga não deve sobreviver à correção.
    setFieldErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  const submit = useCallback(async () => {
    // Rede de segurança: o botão já fica desabilitado com upload em voo (QR-47), mas salvar antes
    // da resposta chegar mandaria a mensagem sem o anexo que o operador acabou de anexar.
    if (!editing || pendingUploads.length > 0) return
    setIsSaving(true)
    setSaveError(undefined)
    setFieldErrors({})
    const result = await submitQuickReply({ api, editing, labels })
    setIsSaving(false)
    if (result.outcome === 'saved') {
      setQuickReplies((current) =>
        editing.id === null
          ? [result.quickReply, ...current]
          : current.map((item) => (item.id === result.quickReply.id ? result.quickReply : item)),
      )
      setEditing(undefined)
      return
    }
    setFieldErrors(result.fieldErrors)
    if (result.outcome === 'rejected') setSaveError(result.formError)
  }, [editing, api, labels, pendingUploads.length])

  const remove = useCallback(
    async (id: string) => {
      if (!api.deleteQuickReply) return
      setDeletingId(id)
      try {
        await api.deleteQuickReply(id)
        setQuickReplies((current) => current.filter((item) => item.id !== id))
      } finally {
        setDeletingId(undefined)
      }
    },
    [api],
  )

  const removeAttachment = useCallback((uploadId: string) => {
    setEditing((current) =>
      current ? { ...current, attachments: current.attachments.filter((a) => a.uploadId !== uploadId) } : current,
    )
  }, [])

  const moveAttachmentAt = useCallback((index: number, direction: -1 | 1) => {
    setEditing((current) =>
      current ? { ...current, attachments: moveAttachment(current.attachments, index, direction) } : current,
    )
  }, [])

  const dismissAttachmentRejections = useCallback(() => setAttachmentRejections([]), [])

  const cancelAttachmentUpload = useCallback((localId: string) => {
    uploadControllersRef.current[localId]?.abort()
    delete uploadControllersRef.current[localId]
    setPendingUploads((current) => current.filter((item) => item.localId !== localId))
  }, [])

  const updatePendingUpload = useCallback((localId: string, patch: Partial<PendingAttachmentUpload>) => {
    setPendingUploads((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }, [])

  /** Sobe um arquivo já validado: progresso real por `onProgress`, "processando" enquanto a
   * promessa não resolve, e o resultado entra em `editing.attachments` na ordem de chegada. */
  const uploadOneFile = useCallback(
    async (localId: string, file: File) => {
      const upload = api.uploadQuickReplyAttachment
      if (!upload) return
      const controller = new AbortController()
      uploadControllersRef.current[localId] = controller
      try {
        const attachment = await upload(file, {
          onProgress: (fraction) => updatePendingUpload(localId, { progress: fraction }),
          signal: controller.signal,
        })
        updatePendingUpload(localId, { status: 'processing', progress: 1 })
        delete uploadControllersRef.current[localId]
        setEditing((current) => (current ? { ...current, attachments: [...current.attachments, attachment] } : current))
        setPendingUploads((current) => current.filter((item) => item.localId !== localId))
      } catch (caught: unknown) {
        delete uploadControllersRef.current[localId]
        if (controller.signal.aborted) return
        updatePendingUpload(localId, {
          status: 'error',
          error: caught instanceof Error ? caught.message : labels.saveError,
        })
      }
    },
    [api, labels, updatePendingUpload],
  )

  const retryAttachmentUpload = useCallback(
    (localId: string) => {
      const item = pendingUploads.find((pending) => pending.localId === localId)
      if (!item) return
      updatePendingUpload(localId, { status: 'uploading', progress: 0, error: undefined })
      void uploadOneFile(localId, item.file)
    },
    [pendingUploads, updatePendingUpload, uploadOneFile],
  )

  /** Valida (teto de 10, tamanho por tipo) ANTES de subir (QR-31) — só o aceito vira upload; o
   * recusado fica em `attachmentRejections` para a tela explicar por quê, sem gastar rede nele. */
  const addAttachmentFiles = useCallback(
    (files: FileList | readonly File[]) => {
      if (!editing || !api.uploadQuickReplyAttachment) return
      const currentCount = editing.attachments.length + pendingUploads.length
      const { accepted, rejected } = validateAttachmentFiles(Array.from(files), currentCount)
      setAttachmentRejections(rejected)
      if (accepted.length === 0) return
      const newItems: PendingAttachmentUpload[] = accepted.map((file) => ({
        localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'uploading',
        progress: 0,
      }))
      setPendingUploads((current) => [...current, ...newItems])
      // Até 3 em paralelo (QR-31): o limitador testado em `quickReplyAttachmentUpload.ts`.
      void mapWithConcurrencyLimit(newItems, 3, (item) => uploadOneFile(item.localId, item.file))
    },
    [editing, api.uploadQuickReplyAttachment, pendingUploads.length, uploadOneFile],
  )

  return {
    quickReplies,
    filtered,
    isLoading,
    loadError,
    search,
    setSearch,
    readOnly: !api.createQuickReply,
    canEdit: Boolean(api.updateQuickReply),
    canDelete: Boolean(api.deleteQuickReply),
    editing,
    startCreate,
    startEdit,
    cancelEdit,
    updateField,
    fieldErrors,
    isSaving,
    saveError,
    submit,
    remove,
    deletingId,
    hasAttachmentsCapability: Boolean(api.uploadQuickReplyAttachment),
    pendingUploads,
    addAttachmentFiles,
    retryAttachmentUpload,
    cancelAttachmentUpload,
    removeAttachment,
    moveAttachmentAt,
    attachmentRejections,
    dismissAttachmentRejections,
  }
}
