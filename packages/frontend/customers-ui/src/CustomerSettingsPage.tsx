/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A página de configuração: quais documentos e quais campos o produto guarda.
 *
 * Ela edita o CATÁLOGO, não uma ficha — e por isso avisa antes de salvar o que a mudança quebra
 * nas fichas que já existem. Quem chega aqui precisa de `customers:admin`: é onde se desliga a
 * máscara de telefone da listagem.
 */

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'

import { useCustomerSettings, useCustomersApi, useCustomersCapabilities } from './providers/CustomersProvider'
import { describeDestructiveChanges, validateSettingsDraft } from './lib/settingsDraft'
import { FIELD_TYPE, type DocumentDefinition, type FieldDefinition, type FieldType } from './providers/types'

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  [FIELD_TYPE.TEXT]: 'Texto',
  [FIELD_TYPE.NUMBER]: 'Número',
  [FIELD_TYPE.MONEY]: 'Dinheiro',
  [FIELD_TYPE.DATE]: 'Data',
  [FIELD_TYPE.BOOLEAN]: 'Sim/Não',
  [FIELD_TYPE.SELECT]: 'Seleção',
}

const INPUT = 'rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800'
const ROW = 'flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700'

export type CustomerSettingsPageProps = {
  readonly onSaved?: () => void
}

export function CustomerSettingsPage({ onSaved }: CustomerSettingsPageProps) {
  const api = useCustomersApi()
  const { settings, error: loadError, reload } = useCustomerSettings()
  const { canEditSettings } = useCustomersCapabilities()

  const [maskPhoneInList, setMaskPhoneInList] = useState(true)
  const [fieldCatalog, setFieldCatalog] = useState<FieldDefinition[]>([])
  const [documentCatalog, setDocumentCatalog] = useState<DocumentDefinition[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!settings) return
    setMaskPhoneInList(settings.maskPhoneInList)
    setFieldCatalog([...settings.fieldCatalog])
    setDocumentCatalog([...settings.documentCatalog])
  }, [settings])

  const errors = useMemo(
    () => validateSettingsDraft({ fieldCatalog, documentCatalog }),
    [fieldCatalog, documentCatalog],
  )

  const warnings = useMemo(
    () =>
      settings
        ? describeDestructiveChanges({ current: settings, draft: { fieldCatalog, documentCatalog } })
        : [],
    [settings, fieldCatalog, documentCatalog],
  )

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar a configuração.{' '}
        <button type="button" onClick={reload} className="font-medium underline">
          Tentar de novo
        </button>
      </div>
    )
  }

  if (!settings) return <p className="p-4 text-sm text-gray-500">Carregando…</p>

  async function handleSave() {
    if (!api.updateSettings || errors.length > 0) return

    setSaving(true)
    setSaveError(undefined)
    try {
      await api.updateSettings({ maskPhoneInList, fieldCatalog, documentCatalog })
      onSaved?.()
    } catch (caught: unknown) {
      // O servidor é quem decide, e ele conhece o dado que já existe — a trava daqui não substitui
      // a dele. O que ele recusar aparece por extenso, e não como "não foi possível salvar".
      setSaveError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={maskPhoneInList}
            disabled={!canEditSettings}
            onChange={(event) => setMaskPhoneInList(event.target.checked)}
          />
          Esconder o miolo do telefone na listagem
        </label>
        <p className="mt-1 text-xs text-gray-500">
          A ficha do cliente continua mostrando o número inteiro para quem tem permissão de leitura.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Documentos</h3>
        {documentCatalog.map((document, index) => (
          <div key={index} className={ROW}>
            <input
              aria-label="Nome interno do documento"
              className={`${INPUT} w-32`}
              value={document.name}
              disabled={!canEditSettings}
              onChange={(event) => setDocumentCatalog(replaceAt(documentCatalog, index, { ...document, name: event.target.value }))}
            />
            <input
              aria-label="Rótulo do documento"
              className={`${INPUT} flex-1 min-w-[120px]`}
              value={document.label}
              disabled={!canEditSettings}
              onChange={(event) => setDocumentCatalog(replaceAt(documentCatalog, index, { ...document, label: event.target.value }))}
            />
            <input
              aria-label="Máscara de exibição"
              placeholder="###.###.###-##"
              className={`${INPUT} w-40`}
              value={document.mask ?? ''}
              disabled={!canEditSettings}
              onChange={(event) => setDocumentCatalog(replaceAt(documentCatalog, index, { ...document, mask: event.target.value || undefined }))}
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={document.required}
                disabled={!canEditSettings}
                onChange={(event) => setDocumentCatalog(replaceAt(documentCatalog, index, { ...document, required: event.target.checked }))}
              />
              Obrigatório
            </label>
            {canEditSettings ? (
              <button type="button" aria-label={`Remover ${document.label}`} onClick={() => setDocumentCatalog(removeAt(documentCatalog, index))}>
                <Trash2 aria-hidden="true" className="h-4 w-4 text-red-600" />
              </button>
            ) : null}
          </div>
        ))}
        {canEditSettings ? (
          <button
            type="button"
            className="flex items-center gap-2 self-start text-sm text-brand-600"
            onClick={() => setDocumentCatalog([...documentCatalog, { name: '', label: '', required: false, validator: 'none' }])}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Adicionar documento
          </button>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Campos do produto</h3>
        {fieldCatalog.map((field, index) => (
          <div key={index} className={ROW}>
            <input
              aria-label="Nome interno do campo"
              className={`${INPUT} w-32`}
              value={field.name}
              disabled={!canEditSettings}
              onChange={(event) => setFieldCatalog(replaceAt(fieldCatalog, index, { ...field, name: event.target.value }))}
            />
            <input
              aria-label="Rótulo do campo"
              className={`${INPUT} flex-1 min-w-[120px]`}
              value={field.label}
              disabled={!canEditSettings}
              onChange={(event) => setFieldCatalog(replaceAt(fieldCatalog, index, { ...field, label: event.target.value }))}
            />
            <select
              aria-label="Tipo do campo"
              className={INPUT}
              value={field.type}
              disabled={!canEditSettings}
              onChange={(event) => setFieldCatalog(replaceAt(fieldCatalog, index, { ...field, type: event.target.value as FieldType }))}
            >
              {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={field.required}
                disabled={!canEditSettings}
                onChange={(event) => setFieldCatalog(replaceAt(fieldCatalog, index, { ...field, required: event.target.checked }))}
              />
              Obrigatório
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={Boolean(field.filterable)}
                // Cifrado não se compara: desligar aqui evita salvar um filtro que nunca acharia nada.
                disabled={!canEditSettings || Boolean(field.encrypted)}
                onChange={(event) => setFieldCatalog(replaceAt(fieldCatalog, index, { ...field, filterable: event.target.checked }))}
              />
              Filtrável
            </label>
            {canEditSettings ? (
              <button type="button" aria-label={`Remover ${field.label}`} onClick={() => setFieldCatalog(removeAt(fieldCatalog, index))}>
                <Trash2 aria-hidden="true" className="h-4 w-4 text-red-600" />
              </button>
            ) : null}
          </div>
        ))}
        {canEditSettings ? (
          <button
            type="button"
            className="flex items-center gap-2 self-start text-sm text-brand-600"
            onClick={() => setFieldCatalog([...fieldCatalog, { name: '', label: '', type: FIELD_TYPE.TEXT, required: false }])}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Adicionar campo
          </button>
        ) : null}
      </section>

      {errors.length > 0 ? (
        <ul role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errors.map((error, index) => (
            <li key={index}>{error.message}</li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="h-4 w-4" />
            O que esta mudança faz com as fichas que já existem
          </p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <p role="alert" className="text-sm text-red-700">
          {saveError}
        </p>
      ) : null}

      {canEditSettings ? (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || errors.length > 0}
          className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar configuração'}
        </button>
      ) : (
        <p className="text-sm text-gray-500">Você não tem permissão para alterar a configuração.</p>
      )}
    </div>
  )
}

function replaceAt<T>(items: readonly T[], index: number, item: T): T[] {
  return items.map((current, position) => (position === index ? item : current))
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index)
}
