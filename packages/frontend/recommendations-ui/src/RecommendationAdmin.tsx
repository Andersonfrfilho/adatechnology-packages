/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A administração inteira numa peça só: lista, ficha da recomendação, campanhas e desempenho.
 * O host só monta dentro do `RecommendationsProvider` e, se tiver, passa a lista de anunciantes.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  buildCampaignPayload,
  buildItemPayload,
  clickRate,
  draftFromItem,
  emptyDraft,
  last30Days,
  toUpdatePayload,
  type CampaignDraft,
  type DraftError,
  type ItemDraft,
} from './lib/itemDraft'
import { useRecommendationLabels, useRecommendationsApi } from './providers/RecommendationsProvider'
import type {
  Campaign,
  CampaignStatsRow,
  FieldDefinition,
  ItemStatus,
  ListItemsQuery,
  PaginatedItems,
  RecommendationItemWithCampaigns,
  RecommendationSettings,
  RecommendationSource,
  SponsorOption,
} from './providers/types'

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800'
const LABEL = 'flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300'
const BUTTON =
  'rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900'
const SECONDARY =
  'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200'
const CELL = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-200'
const HEADER = 'px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400'
const STATUSES: readonly ItemStatus[] = ['draft', 'active', 'paused', 'archived']
const SOURCES: readonly RecommendationSource[] = ['curated', 'sponsored']

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function FieldError({ errors, field }: { readonly errors: readonly DraftError[]; readonly field: string }) {
  const found = errors.find((error) => error.field === field)
  return found ? <span className="text-xs text-red-600">{found.message}</span> : null
}

export type RecommendationAdminProps = {
  /** Anunciantes para o seletor. Sem lista, a ficha pede o id do anunciante. */
  readonly sponsors?: readonly SponsorOption[]
  readonly perPage?: number
}

type View = { readonly mode: 'list' } | { readonly mode: 'new' } | { readonly mode: 'edit'; readonly id: string }

export function RecommendationAdmin({ sponsors, perPage = 20 }: RecommendationAdminProps) {
  const api = useRecommendationsApi()
  const [settings, setSettings] = useState<RecommendationSettings | undefined>(undefined)
  const [settingsError, setSettingsError] = useState<string | undefined>(undefined)
  const [view, setView] = useState<View>({ mode: 'list' })

  useEffect(() => {
    let cancelled = false
    api
      .getSettings()
      .then((loaded) => !cancelled && setSettings(loaded))
      .catch((reason: unknown) => !cancelled && setSettingsError(errorMessage(reason)))
    return () => {
      cancelled = true
    }
  }, [api])

  if (settingsError) return <p className="text-sm text-red-600">{settingsError}</p>
  if (!settings) return <p className="text-sm text-gray-500">…</p>

  if (view.mode === 'list') {
    return (
      <ItemList
        settings={settings}
        sponsors={sponsors}
        perPage={perPage}
        onOpen={(id) => setView({ mode: 'edit', id })}
        onCreate={() => setView({ mode: 'new' })}
      />
    )
  }

  return (
    <ItemEditor
      key={view.mode === 'edit' ? view.id : 'new'}
      settings={settings}
      sponsors={sponsors}
      itemId={view.mode === 'edit' ? view.id : undefined}
      onBack={() => setView({ mode: 'list' })}
      onCreated={(id) => setView({ mode: 'edit', id })}
    />
  )
}

function ItemList(props: {
  readonly settings: RecommendationSettings
  readonly sponsors?: readonly SponsorOption[] | undefined
  readonly perPage: number
  onOpen(id: string): void
  onCreate(): void
}) {
  const api = useRecommendationsApi()
  const labels = useRecommendationLabels()
  const [query, setQuery] = useState<ListItemsQuery>({ page: 1, perPage: props.perPage })
  const [result, setResult] = useState<PaginatedItems | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setError(undefined)
    api
      .listItems(query)
      .then((loaded) => !cancelled && setResult(loaded))
      .catch((reason: unknown) => !cancelled && setError(errorMessage(reason)))
    return () => {
      cancelled = true
    }
  }, [api, query])

  const kindLabel = useMemo(
    () => new Map(props.settings.kinds.map((kind) => [kind.name, kind.label])),
    [props.settings],
  )
  const sponsorLabel = useMemo(
    () => new Map((props.sponsors ?? []).map((sponsor) => [sponsor.id, sponsor.label])),
    [props.sponsors],
  )
  const total = result?.pagination.total ?? 0
  const page = query.page ?? 1
  const lastPage = Math.max(1, Math.ceil(total / props.perPage))

  const filter = (patch: Partial<ListItemsQuery>) => setQuery((current) => ({ ...current, ...patch, page: 1 }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className={`${LABEL} min-w-[200px] flex-1`}>
          {labels.search}
          <input
            type="search"
            className={INPUT}
            onChange={(event) => filter({ search: event.target.value || undefined })}
          />
        </label>
        <label className={LABEL}>
          {labels.kind}
          <select className={INPUT} onChange={(event) => filter({ kind: event.target.value || undefined })}>
            <option value="">{labels.all}</option>
            {props.settings.kinds.map((kind) => (
              <option key={kind.name} value={kind.name}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          {labels.source}
          <select
            className={INPUT}
            onChange={(event) =>
              filter({ source: (event.target.value || undefined) as RecommendationSource | undefined })
            }
          >
            <option value="">{labels.all}</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {labels.sourceLabels[source]}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          {labels.status}
          <select
            className={INPUT}
            onChange={(event) => filter({ status: (event.target.value || undefined) as ItemStatus | undefined })}
          >
            <option value="">{labels.all}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {labels.statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={BUTTON} onClick={props.onCreate}>
          {labels.newItem}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className={HEADER}>{labels.title}</th>
              <th className={HEADER}>{labels.kind}</th>
              <th className={HEADER}>{labels.source}</th>
              <th className={HEADER}>{labels.status}</th>
              <th className={HEADER}>{labels.city}</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.length === 0 ? (
              <tr>
                <td className={CELL} colSpan={5}>
                  {labels.noItems}
                </td>
              </tr>
            ) : null}
            {result?.data.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                onClick={() => props.onOpen(item.id)}
              >
                <td className={CELL}>{item.title}</td>
                <td className={CELL}>{kindLabel.get(item.kind) ?? item.kind}</td>
                <td className={CELL}>
                  {labels.sourceLabels[item.source]}
                  {item.sponsorId ? ` · ${sponsorLabel.get(item.sponsorId) ?? item.sponsorId.slice(0, 8)}` : ''}
                </td>
                <td className={CELL}>{labels.statusLabels[item.status]}</td>
                <td className={CELL}>{[item.city, item.state].filter(Boolean).join(' - ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {total} · {page}/{lastPage}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={SECONDARY}
            disabled={page <= 1}
            onClick={() => setQuery((q) => ({ ...q, page: page - 1 }))}
          >
            {labels.previous}
          </button>
          <button
            type="button"
            className={SECONDARY}
            disabled={page >= lastPage}
            onClick={() => setQuery((q) => ({ ...q, page: page + 1 }))}
          >
            {labels.next}
          </button>
        </div>
      </div>
    </div>
  )
}

function AttributeInput(props: {
  readonly field: FieldDefinition
  readonly value: string | boolean | undefined
  onChange(value: string | boolean): void
}) {
  const { field, value } = props
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
        <input type="checkbox" checked={value === true} onChange={(event) => props.onChange(event.target.checked)} />
        {field.label}
      </label>
    )
  }
  const text = typeof value === 'string' ? value : ''
  if (field.type === 'select') {
    return (
      <select className={INPUT} value={text} onChange={(event) => props.onChange(event.target.value)}>
        <option value="" />
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      className={INPUT}
      type={field.type === 'number' ? 'text' : field.type === 'url' ? 'url' : 'text'}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
      value={text}
      onChange={(event) => props.onChange(event.target.value)}
    />
  )
}

function ItemEditor(props: {
  readonly settings: RecommendationSettings
  readonly sponsors?: readonly SponsorOption[] | undefined
  readonly itemId: string | undefined
  onBack(): void
  onCreated(id: string): void
}) {
  const api = useRecommendationsApi()
  const labels = useRecommendationLabels()
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft(props.settings.kinds[0]))
  const [item, setItem] = useState<RecommendationItemWithCampaigns | undefined>(undefined)
  const [errors, setErrors] = useState<DraftError[]>([])
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!props.itemId) return
    const loaded = await api.getItem(props.itemId)
    setItem(loaded)
    setDraft(draftFromItem(loaded))
  }, [api, props.itemId])

  useEffect(() => {
    load().catch((reason: unknown) => setMessage(errorMessage(reason)))
  }, [load])

  const kind = props.settings.kinds.find((entry) => entry.name === draft.kind)
  const isNew = props.itemId === undefined
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  async function save() {
    const built = buildItemPayload({ draft, kind })
    setErrors(built.errors)
    setMessage(undefined)
    if (built.errors.length > 0) return
    setSaving(true)
    try {
      if (isNew) {
        const created = await api.createItem(built.payload)
        props.onCreated(created.id)
      } else {
        await api.updateItem(props.itemId!, toUpdatePayload(built.payload))
        await load()
        setMessage(labels.saved)
      }
    } catch (reason) {
      setMessage(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  const text = (
    key: 'title' | 'summary' | 'imageUrl' | 'linkUrl' | 'city' | 'state' | 'minAge' | 'maxAge' | 'tags',
    label: string,
    wide = false,
  ): ReactNode => (
    <label className={`${LABEL} ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {key === 'summary' ? (
        <textarea className={INPUT} rows={3} value={draft[key]} onChange={(event) => set(key, event.target.value)} />
      ) : (
        <input
          className={INPUT}
          value={draft[key]}
          inputMode={key === 'minAge' || key === 'maxAge' ? 'numeric' : undefined}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
      <FieldError errors={errors} field={key} />
    </label>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <button type="button" className={SECONDARY} onClick={props.onBack}>
          {labels.cancel}
        </button>
        {message ? <span className="text-sm text-gray-600">{message}</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          {labels.kind}
          <select
            className={INPUT}
            value={draft.kind}
            disabled={!isNew}
            onChange={(event) => set('kind', event.target.value)}
          >
            {props.settings.kinds.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          {labels.source}
          <select
            className={INPUT}
            value={draft.source}
            disabled={!isNew}
            onChange={(event) => set('source', event.target.value as RecommendationSource)}
          >
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {labels.sourceLabels[source]}
              </option>
            ))}
          </select>
        </label>
        {draft.source === 'sponsored' ? (
          <label className={`${LABEL} sm:col-span-2`}>
            {props.sponsors ? labels.sponsor : labels.sponsorId}
            {props.sponsors ? (
              <select
                className={INPUT}
                value={draft.sponsorId}
                onChange={(event) => set('sponsorId', event.target.value)}
              >
                <option value="" />
                {props.sponsors.map((sponsor) => (
                  <option key={sponsor.id} value={sponsor.id}>
                    {sponsor.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={INPUT}
                value={draft.sponsorId}
                onChange={(event) => set('sponsorId', event.target.value)}
              />
            )}
            <FieldError errors={errors} field="sponsorId" />
          </label>
        ) : null}
        {text('title', labels.title, true)}
        {text('summary', labels.summary, true)}
        {text('imageUrl', labels.imageUrl)}
        {text('linkUrl', labels.linkUrl)}
        {text('city', labels.city)}
        {text('state', labels.state)}
        {text('minAge', labels.minAge)}
        {text('maxAge', labels.maxAge)}
        {text('tags', labels.tags, true)}
        {kind?.fields.map((field) => (
          <label key={field.name} className={LABEL}>
            {field.type === 'boolean' ? null : field.label}
            <AttributeInput
              field={field}
              value={draft.attributes[field.name]}
              onChange={(value) => set('attributes', { ...draft.attributes, [field.name]: value })}
            />
            <FieldError errors={errors} field={`attributes.${field.name}`} />
          </label>
        ))}
        <label className={LABEL}>
          {labels.status}
          <select
            className={INPUT}
            value={draft.status}
            onChange={(event) => set('status', event.target.value as ItemStatus)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {labels.statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <button type="button" className={BUTTON} disabled={saving} onClick={save}>
          {labels.save}
        </button>
      </div>

      {item && item.source === 'sponsored' ? (
        <CampaignsPanel settings={props.settings} item={item} onChanged={() => load().catch(() => undefined)} />
      ) : null}
      {item ? <StatsPanel itemId={item.id} campaigns={item.campaigns} settings={props.settings} /> : null}
    </div>
  )
}

function CampaignsPanel(props: {
  readonly settings: RecommendationSettings
  readonly item: RecommendationItemWithCampaigns
  onChanged(): void
}) {
  const api = useRecommendationsApi()
  const labels = useRecommendationLabels()
  const [draft, setDraft] = useState<CampaignDraft>({
    plan: props.settings.plans[0]?.name ?? '',
    priority: '',
    startsAt: '',
    endsAt: '',
    placements: [],
  })
  const [errors, setErrors] = useState<DraftError[]>([])
  const [message, setMessage] = useState<string | undefined>(undefined)

  const planLabel = new Map(props.settings.plans.map((plan) => [plan.name, plan.label]))
  const placementLabel = new Map(props.settings.placements.map((placement) => [placement.name, placement.label]))

  async function create() {
    const built = buildCampaignPayload(draft)
    setErrors(built.errors)
    setMessage(undefined)
    if (built.errors.length > 0) return
    try {
      await api.createCampaign(props.item.id, built.payload)
      setDraft((current) => ({ ...current, startsAt: '', endsAt: '' }))
      props.onChanged()
    } catch (reason) {
      setMessage(errorMessage(reason))
    }
  }

  async function toggle(campaign: Campaign) {
    try {
      await api.updateCampaign(campaign.id, { status: campaign.status === 'active' ? 'paused' : 'active' })
      props.onChanged()
    } catch (reason) {
      setMessage(errorMessage(reason))
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.campaigns}</h3>
      {props.item.campaigns.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {props.item.campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"
            >
              <span>
                {planLabel.get(campaign.plan) ?? campaign.plan} · {labels.campaignStatusLabels[campaign.status]} ·{' '}
                {new Date(campaign.startsAt).toLocaleDateString()}
                {campaign.endsAt ? ` – ${new Date(campaign.endsAt).toLocaleDateString()}` : ''}
                {campaign.placements.length > 0
                  ? ` · ${campaign.placements.map((name) => placementLabel.get(name) ?? name).join(', ')}`
                  : ''}
              </span>
              {campaign.status === 'ended' ? null : (
                <button type="button" className={SECONDARY} onClick={() => toggle(campaign)}>
                  {campaign.status === 'active' ? labels.pause : labels.activate}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-gray-300 p-3 sm:grid-cols-2 dark:border-gray-600">
        <label className={LABEL}>
          {labels.plan}
          <select
            className={INPUT}
            value={draft.plan}
            onChange={(event) => setDraft({ ...draft, plan: event.target.value })}
          >
            {props.settings.plans.map((plan) => (
              <option key={plan.name} value={plan.name}>
                {plan.label}
              </option>
            ))}
          </select>
          <FieldError errors={errors} field="plan" />
        </label>
        <label className={LABEL}>
          {labels.priority}
          <input
            className={INPUT}
            inputMode="numeric"
            value={draft.priority}
            onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
          />
          <FieldError errors={errors} field="priority" />
        </label>
        <label className={LABEL}>
          {labels.startsAt}
          <input
            type="datetime-local"
            className={INPUT}
            value={draft.startsAt}
            onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
          />
          <FieldError errors={errors} field="startsAt" />
        </label>
        <label className={LABEL}>
          {labels.endsAt}
          <input
            type="datetime-local"
            className={INPUT}
            value={draft.endsAt}
            onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
          />
          <FieldError errors={errors} field="endsAt" />
        </label>
        <fieldset className={`${LABEL} sm:col-span-2`}>
          <legend>{labels.placements}</legend>
          <div className="flex flex-wrap gap-3">
            {props.settings.placements.map((placement) => (
              <label key={placement.name} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={draft.placements.includes(placement.name)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      placements: event.target.checked
                        ? [...draft.placements, placement.name]
                        : draft.placements.filter((name) => name !== placement.name),
                    })
                  }
                />
                {placement.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <button type="button" className={BUTTON} onClick={create}>
            {labels.newCampaign}
          </button>
          {message ? <span className="ml-3 text-sm text-red-600">{message}</span> : null}
        </div>
      </div>
    </section>
  )
}

function StatsPanel(props: {
  readonly itemId: string
  readonly campaigns: readonly Campaign[]
  readonly settings: RecommendationSettings
}) {
  const api = useRecommendationsApi()
  const labels = useRecommendationLabels()
  const [rows, setRows] = useState<readonly CampaignStatsRow[]>([])

  useEffect(() => {
    let cancelled = false
    api
      .getStats({ ...last30Days(), itemId: props.itemId })
      .then((loaded) => !cancelled && setRows(loaded))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [api, props.itemId])

  const placementLabel = new Map(props.settings.placements.map((placement) => [placement.name, placement.label]))
  const totals = rows.reduce(
    (sum, row) => ({ impressions: sum.impressions + row.impressions, clicks: sum.clicks + row.clicks }),
    {
      impressions: 0,
      clicks: 0,
    },
  )

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{labels.stats}</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className={HEADER}>{labels.placements}</th>
              <th className={HEADER}>{labels.impressions}</th>
              <th className={HEADER}>{labels.clicks}</th>
              <th className={HEADER}>{labels.ctr}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.campaignId ?? '-'}:${row.placement}`}
                className="border-t border-gray-100 dark:border-gray-700"
              >
                <td className={CELL}>{placementLabel.get(row.placement) ?? row.placement}</td>
                <td className={CELL}>{row.impressions}</td>
                <td className={CELL}>{row.clicks}</td>
                <td className={CELL}>{clickRate(row.impressions, row.clicks)}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 font-semibold dark:border-gray-600">
              <td className={CELL}>Total</td>
              <td className={CELL}>{totals.impressions}</td>
              <td className={CELL}>{totals.clicks}</td>
              <td className={CELL}>{clickRate(totals.impressions, totals.clicks)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
