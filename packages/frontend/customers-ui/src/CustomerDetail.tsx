/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A ficha. Os campos comuns são fixos; documentos e atributos vêm do CATÁLOGO — é por isso que o
 * mesmo componente serve mercado, financiamento e atendimento sem um `if` por produto.
 */

import { useEffect, useState } from 'react'
import { MessageCircle, Star } from 'lucide-react'

import { useCustomerSettings, useCustomersApi, useCustomersCapabilities } from './providers/CustomersProvider'
import { applyMask, formatDate, formatPhone } from './lib/format'
import { inputTypeFor, parseAttribute, validateAttributes, type AttributeError } from './lib/attributes'
import type { Customer, FieldDefinition } from './providers/types'

export type CustomerDetailProps = {
  readonly customerId: string
  readonly onSaved?: (customer: Customer) => void
}

const LABEL = 'block text-xs font-medium uppercase text-gray-500 dark:text-gray-400'
const INPUT =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 aria-[invalid=true]:border-red-500'

export function CustomerDetail({ customerId, onSaved }: CustomerDetailProps) {
  const api = useCustomersApi()
  const { settings, error: settingsError } = useCustomerSettings()
  const { canWrite } = useCustomersCapabilities()

  const [customer, setCustomer] = useState<Customer | undefined>(undefined)
  const [attributes, setAttributes] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<readonly AttributeError[]>([])
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<Error | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    api
      .getCustomer(customerId)
      .then((loaded) => {
        if (cancelled) return
        setCustomer(loaded)
        setAttributes({ ...loaded.attributes })
      })
      .catch((caught: unknown) => {
        if (!cancelled) setLoadError(caught instanceof Error ? caught : new Error(String(caught)))
      })

    return () => {
      cancelled = true
    }
  }, [api, customerId])

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Não foi possível carregar a ficha deste cliente.
      </div>
    )
  }

  // Catálogo que não carregou NÃO vira ficha sem campos: o operador salvaria por cima achando que
  // os campos do produto não existem.
  if (settingsError) {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        A configuração de campos não carregou. A ficha não pode ser editada com segurança agora.
      </div>
    )
  }

  if (!customer || !settings) return <p className="p-4 text-sm text-gray-500">Carregando…</p>

  async function handleSave() {
    if (!customer || !settings || !api.updateCustomer) return

    const found = validateAttributes({ fields: settings.fieldCatalog, attributes })
    setErrors(found)
    if (found.length > 0) {
      // O primeiro campo recusado recebe o foco: dizer o nome orienta, levar até lá é o que poupa
      // varrer a ficha inteira procurando o rótulo que se acabou de ler (`web.md` §11).
      document.getElementById(`attribute-${found[0]?.name}`)?.focus()
      return
    }

    setSaving(true)
    try {
      await api.updateCustomer(customer.id, { attributes })
      onSaved?.({ ...customer, attributes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-lg font-semibold">{customer.name ?? 'Sem nome'}</h2>
        {customer.email ? <p className="text-sm text-gray-500">{customer.email}</p> : null}
        {customer.birthDate ? (
          <p className="text-sm text-gray-500">Nascimento: {formatDate(customer.birthDate)}</p>
        ) : null}
      </section>

      <section>
        <h3 className={LABEL}>Telefones</h3>
        <ul className="mt-2 flex flex-col gap-1">
          {customer.phones.map((phone) => (
            <li key={phone.id} className="flex items-center gap-2 text-sm">
              {/* Na FICHA o telefone sai inteiro: quem abriu a ficha já passou pelo escopo de leitura. */}
              <span>{formatPhone(phone.number)}</span>
              {phone.label ? <span className="text-gray-400">({phone.label})</span> : null}
              {phone.isWhatsApp ? (
                <MessageCircle aria-label="WhatsApp" className="h-4 w-4 text-green-600" />
              ) : null}
              {phone.isPrimary ? <Star aria-label="Principal" className="h-4 w-4 text-amber-500" /> : null}
            </li>
          ))}
        </ul>
      </section>

      {settings.documentCatalog.length > 0 ? (
        <section>
          <h3 className={LABEL}>Documentos</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {settings.documentCatalog.map((definition) => {
              const document = customer.documents.find((entry) => entry.name === definition.name)
              return (
                <li key={definition.name} className="flex gap-2">
                  <span className="text-gray-500">{definition.label}:</span>
                  <span>{document ? applyMask(document.value, definition.mask) : '—'}</span>
                  {document?.valid === false ? (
                    <span className="text-red-600">inválido</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {customer.addresses.length > 0 ? (
        <section>
          <h3 className={LABEL}>Endereços</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {customer.addresses.map((address) => (
              <li key={address.id} className="flex items-center gap-2">
                <span>
                  {[address.street, address.number, address.district, address.city, address.state]
                    .filter(Boolean)
                    .join(', ')}
                </span>
                {address.isPrimary ? <Star aria-label="Principal" className="h-4 w-4 text-amber-500" /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {settings.fieldCatalog.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className={LABEL}>Informações do produto</h3>
          {settings.fieldCatalog.map((field) => (
            <AttributeField
              key={field.name}
              field={field}
              value={attributes[field.name]}
              disabled={!canWrite}
              error={errors.find((entry) => entry.name === field.name)?.message}
              onChange={(value) => setAttributes((current) => ({ ...current, [field.name]: value }))}
            />
          ))}

          {canWrite ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function AttributeField(props: {
  readonly field: FieldDefinition
  readonly value: unknown
  readonly disabled: boolean
  readonly error?: string
  onChange(value: unknown): void
}) {
  const { field, error } = props
  const inputId = `attribute-${field.name}`
  const errorId = `${inputId}-error`

  if (field.type === 'select') {
    return (
      <div>
        <label htmlFor={inputId} className={LABEL}>
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        <select
          id={inputId}
          className={INPUT}
          disabled={props.disabled}
          value={typeof props.value === 'string' ? props.value : ''}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => props.onChange(event.target.value || undefined)}
        >
          <option value="">Selecione…</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? <FieldError id={errorId} message={error} /> : null}
      </div>
    )
  }

  const inputType = inputTypeFor(field)

  if (inputType === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="checkbox"
          disabled={props.disabled}
          checked={props.value === true}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        <label htmlFor={inputId} className="text-sm">
          {field.label}
        </label>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={inputId} className={LABEL}>
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      <input
        id={inputId}
        type={inputType}
        className={INPUT}
        disabled={props.disabled}
        defaultValue={props.value === undefined || props.value === null ? '' : String(props.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => props.onChange(parseAttribute(field, event.target.value))}
      />
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  )
}

function FieldError({ id, message }: { readonly id: string; readonly message: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {message}
    </p>
  )
}
