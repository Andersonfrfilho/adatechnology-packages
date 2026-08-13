import { useState, useCallback, useEffect, useRef, type FormEvent } from 'react'
import type { Product, Catalog, Section, CreateProductInput, ProductSuggestion } from './providers/types'
import { DEFAULT_UNIT_OPTIONS, PRODUCT_OPTIONAL_FIELD } from './providers/types'
import { useIsProductFieldEnabled, useProductsConfig } from './providers/ProductsProvider'
import { applyMarginToCost, formatMoney, maskMoneyInput } from './lib/money'

const SUGGESTION_MIN_QUERY_LENGTH = 2
const SUGGESTION_DEBOUNCE_MS = 400

export type ProductFormProps = {
  readonly onSubmit: (data: CreateProductInput & { active?: boolean; sortOrder?: number }) => Promise<void>
  readonly initialValues?: Partial<Product>
  readonly catalogs: readonly Catalog[]
  readonly sections: readonly Section[]
  // Leitura de código de barras. A captura é do host — depende de câmera, permissão e biblioteca
  // que não cabem num pacote de UI. Resolver com `null` quando o usuário cancela; sem a prop, o
  // botão de escanear não aparece. O retorno é uma sugestão, e não só o código, porque o host que
  // consulta uma base de GTIN já tem nome e imagem em mãos — devolver só o número obrigaria o
  // usuário a redigitar o que o scanner acabou de descobrir.
  readonly onScanBarcode?: () => Promise<ProductSuggestion | null>
  // Busca em base externa de produtos. Sem a prop, o campo de nome é um input comum.
  readonly onSearchSuggestions?: (query: string) => Promise<readonly ProductSuggestion[]>
}

// Texto exibido e centavos andam juntos no estado: o texto é o que o usuário vê e os centavos são
// o que vai para a API. Derivar um do outro na hora de submeter obrigaria a reinterpretar a
// string já formatada, que é onde o separador decimal por locale quebra.
type MoneyField = {
  readonly text: string
  readonly amountInCents: number
}

type FormState = {
  name: string
  description: string
  price: MoneyField
  costPrice: MoneyField
  unit: string
  barcode: string
  catalogId: string
  sectionId: string
  imageUrl: string
  inventory: string
  preparationTimeMinutes: string
  preparationInstructions: string
  sortOrder: string
  active: boolean
}

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export function ProductForm({
  onSubmit,
  initialValues,
  catalogs,
  sections,
  onScanBarcode,
  onSearchSuggestions,
}: ProductFormProps) {
  const config = useProductsConfig()
  const isFieldEnabled = useIsProductFieldEnabled()
  const moneyFormat = { currency: config.currency, locale: config.locale }

  const toMoneyField = useCallback(
    (amountInCents: number | null | undefined): MoneyField =>
      amountInCents ? { text: formatMoney(amountInCents, moneyFormat), amountInCents } : { text: '', amountInCents: 0 },
    [config.currency, config.locale],
  )

  const [form, setForm] = useState<FormState>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    price: toMoneyField(initialValues?.priceInCents),
    costPrice: toMoneyField(initialValues?.costPriceInCents),
    unit: initialValues?.unit ?? (config.unitOptions ?? DEFAULT_UNIT_OPTIONS)[0] ?? '',
    barcode: initialValues?.barcode ?? '',
    catalogId: initialValues?.catalogId ?? '',
    sectionId: initialValues?.sectionId ?? '',
    imageUrl: initialValues?.imageUrl ?? '',
    inventory: initialValues?.inventory?.toString() ?? '0',
    preparationTimeMinutes: initialValues?.preparationTimeMinutes?.toString() ?? '',
    preparationInstructions: initialValues?.preparationInstructions ?? '',
    sortOrder: initialValues?.sortOrder?.toString() ?? '0',
    active: initialValues?.active ?? true,
  })

  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [suggestions, setSuggestions] = useState<readonly ProductSuggestion[]>([])
  const [scanning, setScanning] = useState(false)
  // Escolher uma sugestão preenche o nome, e o nome preenchido dispararia a busca de novo. O flag
  // corta esse ciclo sem precisar comparar strings.
  const skipNextSearch = useRef(false)

  const updateField = useCallback((field: keyof FormState, value: string | boolean | MoneyField) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const handleMoneyChange = useCallback(
    (field: 'price' | 'costPrice', value: string) => {
      updateField(field, maskMoneyInput(value, moneyFormat))
    },
    [updateField, config.currency, config.locale],
  )

  const handleMarginShortcut = useCallback(
    (percent: number) => {
      const amountInCents = applyMarginToCost(form.costPrice.amountInCents, percent)
      updateField('price', { text: formatMoney(amountInCents, moneyFormat), amountInCents })
    },
    [form.costPrice.amountInCents, updateField, config.currency, config.locale],
  )

  useEffect(() => {
    if (!onSearchSuggestions) return
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    if (form.name.trim().length < SUGGESTION_MIN_QUERY_LENGTH) {
      setSuggestions([])
      return
    }

    let active = true
    const timer = setTimeout(() => {
      void onSearchSuggestions(form.name.trim())
        .then((results) => {
          if (active) setSuggestions(results)
        })
        // Sugestão é conveniência: base externa fora do ar não pode impedir o cadastro manual.
        .catch(() => {
          if (active) setSuggestions([])
        })
    }, SUGGESTION_DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [form.name, onSearchSuggestions])

  const handleSelectSuggestion = useCallback((suggestion: ProductSuggestion) => {
    skipNextSearch.current = true
    setSuggestions([])
    setForm((prev) => ({
      ...prev,
      name: suggestion.name,
      ...(suggestion.barcode ? { barcode: suggestion.barcode } : {}),
      ...(suggestion.imageUrl ? { imageUrl: suggestion.imageUrl } : {}),
    }))
  }, [])

  const handleScanBarcode = useCallback(async () => {
    if (!onScanBarcode) return
    setScanning(true)
    try {
      const scanned = await onScanBarcode()
      if (scanned) {
        skipNextSearch.current = true
        setSuggestions([])
        setForm((prev) => ({
          ...prev,
          ...(scanned.name ? { name: scanned.name } : {}),
          ...(scanned.barcode ? { barcode: scanned.barcode.replace(/\D/g, '') } : {}),
          ...(scanned.imageUrl ? { imageUrl: scanned.imageUrl } : {}),
        }))
      }
    } finally {
      setScanning(false)
    }
  }, [onScanBarcode])

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    if (form.price.amountInCents <= 0) {
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
      // Campo de vertical desligado não é enviado como vazio: ele simplesmente não faz parte do
      // produto deste consumidor, e mandar `undefined` explícito apagaria o valor no update.
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceInCents: form.price.amountInCents,
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.COST_PRICE) && form.costPrice.amountInCents > 0
          ? { costPriceInCents: form.costPrice.amountInCents }
          : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.UNIT) && form.unit ? { unit: form.unit } : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.BARCODE) && form.barcode.trim()
          ? { barcode: form.barcode.trim() }
          : {}),
        ...(form.catalogId ? { catalogId: form.catalogId } : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SECTION) && form.sectionId
          ? { sectionId: form.sectionId }
          : {}),
        ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.INVENTORY)
          ? { inventory: Number.parseInt(form.inventory, 10) || 0 }
          : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.PREPARATION_TIME) && form.preparationTimeMinutes
          ? { preparationTimeMinutes: Number.parseInt(form.preparationTimeMinutes, 10) }
          : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.PREPARATION_INSTRUCTIONS) &&
        form.preparationInstructions.trim()
          ? { preparationInstructions: form.preparationInstructions.trim() }
          : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SORT_ORDER)
          ? { sortOrder: Number.parseInt(form.sortOrder, 10) || 0 }
          : {}),
        active: form.active,
      })
    } finally {
      setSubmitting(false)
    }
  }, [form, isFieldEnabled, onSubmit, validate])

  const isEditing = !!initialValues?.id
  const showCostPrice = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.COST_PRICE)
  const showUnit = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.UNIT)
  const showBarcode = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.BARCODE)
  const showSection = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SECTION)
  const showInventory = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.INVENTORY)
  const showPreparationTime = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.PREPARATION_TIME)
  const showPreparationInstructions = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.PREPARATION_INSTRUCTIONS)
  const showSortOrder = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SORT_ORDER)
  const moneyPlaceholder = formatMoney(0, moneyFormat)
  const unitOptions = config.unitOptions ?? DEFAULT_UNIT_OPTIONS
  const marginShortcuts = config.marginShortcutPercents ?? []

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="relative">
        <label className={LABEL_CLASS}>Nome do produto *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          className={`${INPUT_CLASS} ${errors.name ? 'border-red-300 bg-red-50' : ''}`}
          placeholder="Ex: Pizza Margherita"
          autoComplete="off"
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        {suggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.barcode ?? suggestion.name}-${index}`}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {suggestion.imageUrl && (
                    <img src={suggestion.imageUrl} alt="" className="w-8 h-8 rounded object-cover bg-gray-100 dark:bg-gray-800" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{suggestion.name}</span>
                    {suggestion.brand && (
                      <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">{suggestion.brand}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className={LABEL_CLASS}>Descrição</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          className={INPUT_CLASS}
          placeholder="Descrição do produto..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Preço de venda *</label>
          <input
            type="text"
            value={form.price.text}
            onChange={(e) => handleMoneyChange('price', e.target.value)}
            className={`${INPUT_CLASS} ${errors.price ? 'border-red-300 bg-red-50' : ''}`}
            placeholder={moneyPlaceholder}
          />
          {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
        </div>
        {showCostPrice && (
          <div>
            <label className={LABEL_CLASS}>Preço de custo</label>
            <input
              type="text"
              value={form.costPrice.text}
              onChange={(e) => handleMoneyChange('costPrice', e.target.value)}
              className={INPUT_CLASS}
              placeholder={moneyPlaceholder}
            />
            {form.costPrice.amountInCents > 0 && marginShortcuts.length > 0 && (
              <div className="flex gap-2 mt-2">
                {marginShortcuts.map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => handleMarginShortcut(percent)}
                    className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-brand-100 hover:text-brand-700 transition-colors"
                  >
                    +{percent}%
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(showUnit || showBarcode) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showUnit && (
            <div>
              <label className={LABEL_CLASS}>Unidade</label>
              <select
                value={form.unit}
                onChange={(e) => updateField('unit', e.target.value)}
                className={INPUT_CLASS}
              >
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          )}
          {showBarcode && (
            <div>
              <label className={LABEL_CLASS}>Código de barras</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.barcode}
                  onChange={(e) => updateField('barcode', e.target.value.replace(/\D/g, ''))}
                  className={`flex-1 ${INPUT_CLASS}`}
                  placeholder="7891234567890"
                  maxLength={13}
                />
                {onScanBarcode && (
                  <button
                    type="button"
                    onClick={() => void handleScanBarcode()}
                    disabled={scanning}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
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
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>Catálogo</label>
          <select
            value={form.catalogId}
            onChange={(e) => updateField('catalogId', e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Nenhum</option>
            {catalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>{catalog.name}</option>
            ))}
          </select>
        </div>
        {showSection && (
          <div>
            <label className={LABEL_CLASS}>Seção</label>
            <select
              value={form.sectionId}
              onChange={(e) => updateField('sectionId', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Nenhuma</option>
              {sections
                .filter(
                  (section) =>
                    !section.catalogId || !form.catalogId || section.catalogId === form.catalogId,
                )
                .map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className={LABEL_CLASS}>URL da imagem</label>
        <input
          type="text"
          value={form.imageUrl}
          onChange={(e) => updateField('imageUrl', e.target.value)}
          className={INPUT_CLASS}
          placeholder="https://..."
        />
        {form.imageUrl && (
          <img src={form.imageUrl} alt="Preview" className="mt-2 w-20 h-20 rounded-lg object-cover bg-gray-100 dark:bg-gray-800" />
        )}
      </div>

      {(showInventory || showPreparationTime) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showInventory && (
            <div>
              <label className={LABEL_CLASS}>Estoque</label>
              <input
                type="number"
                value={form.inventory}
                onChange={(e) => updateField('inventory', e.target.value)}
                className={INPUT_CLASS}
                min={0}
              />
            </div>
          )}
          {showPreparationTime && (
            <div>
              <label className={LABEL_CLASS}>Tempo de preparo (min)</label>
              <input
                type="number"
                value={form.preparationTimeMinutes}
                onChange={(e) => updateField('preparationTimeMinutes', e.target.value)}
                className={INPUT_CLASS}
                min={0}
                placeholder="Ex: 15"
              />
            </div>
          )}
        </div>
      )}

      {showSortOrder && (
        <div>
          <label className={LABEL_CLASS}>Ordem de exibição</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => updateField('sortOrder', e.target.value)}
            className={INPUT_CLASS}
            min={0}
          />
        </div>
      )}

      {showPreparationInstructions && (
        <div>
          <label className={LABEL_CLASS}>Modo de preparo</label>
          <textarea
            value={form.preparationInstructions}
            onChange={(e) => updateField('preparationInstructions', e.target.value)}
            rows={3}
            className={INPUT_CLASS}
            placeholder="Instruções para quem produz o item..."
          />
        </div>
      )}

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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Produto ativo</span>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
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
