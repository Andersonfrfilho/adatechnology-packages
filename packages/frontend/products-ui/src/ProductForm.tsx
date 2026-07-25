import { useState, useCallback, type FormEvent } from 'react'
import type { Product, Catalog, Section, CreateProductInput } from './providers/types'
import { formatBRL } from './lib/format'

const UNIT_OPTIONS = ['un', 'kg', 'g', 'l', 'ml', 'pc', 'cx', 'dz'] as const

export interface ProductFormProps {
  onSubmit: (data: CreateProductInput & { active?: boolean; sortOrder?: number }) => Promise<void>
  initialValues?: Partial<Product>
  catalogs: Catalog[]
  sections: Section[]
}

interface FormState {
  name: string
  description: string
  price: string
  costPrice: string
  unit: string
  barcode: string
  catalogId: string
  sectionId: string
  imageUrl: string
  inventory: string
  preparationTimeMinutes: string
  active: boolean
}

function toBRLMask(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  const number = parseInt(digits, 10) / 100
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fromBRL(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function applyMargin(cost: number, marginPercent: number): string {
  if (cost <= 0) return ''
  const price = cost / (1 - marginPercent / 100)
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ProductForm({ onSubmit, initialValues, catalogs, sections }: ProductFormProps) {
  const [form, setForm] = useState<FormState>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    price: initialValues?.price ? formatBRL(initialValues.price) : '',
    costPrice: initialValues?.costPrice ? formatBRL(initialValues.costPrice) : '',
    unit: initialValues?.unit ?? 'un',
    barcode: initialValues?.barcode ?? '',
    catalogId: initialValues?.catalogId ?? '',
    sectionId: initialValues?.sectionId ?? '',
    imageUrl: initialValues?.imageUrl ?? '',
    inventory: initialValues?.inventory?.toString() ?? '0',
    preparationTimeMinutes: initialValues?.preparationTimeMinutes?.toString() ?? '',
    active: initialValues?.active ?? true,
  })

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const updateField = useCallback((field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handlePriceChange = useCallback((value: string) => {
    updateField('price', toBRLMask(value))
  }, [updateField])

  const handleCostPriceChange = useCallback((value: string) => {
    updateField('costPrice', toBRLMask(value))
  }, [updateField])

  const handleMarginShortcut = useCallback((percent: number) => {
    const cost = fromBRL(form.costPrice)
    const price = applyMargin(cost, percent)
    updateField('price', price)
  }, [form.costPrice, updateField])

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    const priceValue = fromBRL(form.price)
    if (!form.price || priceValue <= 0) {
      newErrors.price = 'Preço deve ser maior que zero'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: fromBRL(form.price),
        costPrice: form.costPrice ? fromBRL(form.costPrice) : undefined,
        unit: form.unit || undefined,
        barcode: form.barcode.trim() || undefined,
        catalogId: form.catalogId || undefined,
        sectionId: form.sectionId || undefined,
        imageUrl: form.imageUrl || undefined,
        inventory: parseInt(form.inventory, 10) || 0,
        preparationTimeMinutes: form.preparationTimeMinutes
          ? parseInt(form.preparationTimeMinutes, 10)
          : undefined,
        active: form.active,
      })
    } finally {
      setSubmitting(false)
    }
  }, [form, onSubmit, validate])

  const isEditing = !!initialValues?.id

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome do produto *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
            errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="Ex: Pizza Margherita"
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição
        </label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Descrição do produto..."
        />
      </div>

      {/* Price + Cost Price + Margin shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preço de venda *
          </label>
          <input
            type="text"
            value={form.price}
            onChange={(e) => handlePriceChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              errors.price ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="R$ 0,00"
          />
          {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preço de custo
          </label>
          <input
            type="text"
            value={form.costPrice}
            onChange={(e) => handleCostPriceChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="R$ 0,00"
          />
          {form.costPrice && fromBRL(form.costPrice) > 0 && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleMarginShortcut(30)}
                className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-brand-100 hover:text-brand-700 transition-colors"
              >
                +30%
              </button>
              <button
                type="button"
                onClick={() => handleMarginShortcut(50)}
                className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-brand-100 hover:text-brand-700 transition-colors"
              >
                +50%
              </button>
              <button
                type="button"
                onClick={() => handleMarginShortcut(100)}
                className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-brand-100 hover:text-brand-700 transition-colors"
              >
                +100%
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Unit + Barcode */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unidade
          </label>
          <select
            value={form.unit}
            onChange={(e) => updateField('unit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código de barras
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => updateField('barcode', e.target.value.replace(/\D/g, ''))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="7891234567890"
              maxLength={13}
            />
            <button
              type="button"
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
              title="Escanear código de barras"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Catalog + Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catálogo
          </label>
          <select
            value={form.catalogId}
            onChange={(e) => updateField('catalogId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Nenhum</option>
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seção
          </label>
          <select
            value={form.sectionId}
            onChange={(e) => updateField('sectionId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Nenhuma</option>
            {sections
              .filter((s) => !form.catalogId || s.catalogId === form.catalogId)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Image URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL da imagem
        </label>
        <input
          type="text"
          value={form.imageUrl}
          onChange={(e) => updateField('imageUrl', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="https://..."
        />
        {form.imageUrl && (
          <img
            src={form.imageUrl}
            alt="Preview"
            className="mt-2 w-20 h-20 rounded-lg object-cover bg-gray-100"
          />
        )}
      </div>

      {/* Inventory + Preparation Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estoque
          </label>
          <input
            type="number"
            value={form.inventory}
            onChange={(e) => updateField('inventory', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            min={0}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tempo de preparo (min)
          </label>
          <input
            type="number"
            value={form.preparationTimeMinutes}
            onChange={(e) => updateField('preparationTimeMinutes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            min={0}
            placeholder="Ex: 15"
          />
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => updateField('active', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
        </label>
        <span className="text-sm font-medium text-gray-700">
          Produto ativo
        </span>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Salvando...' : isEditing ? 'Atualizar produto' : 'Criar produto'}
        </button>
      </div>
    </form>
  )
}
