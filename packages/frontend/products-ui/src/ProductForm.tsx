import { ChevronDown } from 'lucide-react'
import { useState, useCallback, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import type { Product, Catalog, Section, CreateProductInput, ProductField, ProductSuggestion } from './providers/types'
import { DEFAULT_UNIT_OPTIONS, PRODUCT_FIELD, PRODUCT_OPTIONAL_FIELD, PRODUCT_SURFACE } from './providers/types'
import {
  useIsProductFieldEnabled,
  useIsProductFieldRequired,
  useIsProductFieldVisible,
  useProductLabel,
  useProducts,
  useProductsConfig,
} from './providers/ProductsProvider'
import { ImageUpload } from './ImageUpload'
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
  unitSize: string
  brand: string
  aisle: string
  // Um campo de texto, separado por vírgula: apelido se cadastra em rajada ("miojo, lámen,
  // macarrão instantâneo"), e uma linha por apelido faria quatro cliques para cada produto.
  aliases: string
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

// Campos de texto que podem entrar em `requiredFields`, e onde cada um mora no estado. Uma tabela,
// e não um `switch` na validação, para que acrescentar campo não exija lembrar de dois lugares.
type TextFieldKey = Extract<
  keyof FormState,
  | 'description'
  | 'unit'
  | 'unitSize'
  | 'brand'
  | 'aisle'
  | 'aliases'
  | 'barcode'
  | 'catalogId'
  | 'sectionId'
  | 'imageUrl'
  | 'inventory'
  | 'preparationTimeMinutes'
  | 'preparationInstructions'
>

const TEXT_FIELD_STATE_KEYS: ReadonlyArray<readonly [ProductField, TextFieldKey]> = [
  [PRODUCT_FIELD.DESCRIPTION, 'description'],
  [PRODUCT_FIELD.UNIT, 'unit'],
  [PRODUCT_FIELD.UNIT_SIZE, 'unitSize'],
  [PRODUCT_FIELD.BRAND, 'brand'],
  [PRODUCT_FIELD.AISLE, 'aisle'],
  [PRODUCT_FIELD.ALIASES, 'aliases'],
  [PRODUCT_FIELD.BARCODE, 'barcode'],
  [PRODUCT_FIELD.CATALOG, 'catalogId'],
  [PRODUCT_FIELD.SECTION, 'sectionId'],
  [PRODUCT_FIELD.IMAGE, 'imageUrl'],
  [PRODUCT_FIELD.INVENTORY, 'inventory'],
  [PRODUCT_FIELD.PREPARATION_TIME, 'preparationTimeMinutes'],
  [PRODUCT_FIELD.PREPARATION_INSTRUCTIONS, 'preparationInstructions'],
]

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// `appearance-none` troca a seta do sistema pelo chevron desenhado abaixo: a nativa muda de forma e
// de tamanho entre navegadores, e ao lado de um input de texto o campo parecia de outra tela.
// `min-h-11` e a area de toque de 44px; `py-2` sozinho entrega 36px e erra o dedo no celular.
// O fundo e explicito porque select sem `bg` herda o do sistema, que ignora o tema escuro.
const SELECT_CLASS = `${INPUT_CLASS} appearance-none min-h-11 pr-9 cursor-pointer bg-white dark:bg-gray-900`

type SelectFieldProps = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error?: string | undefined
  readonly children: ReactNode
}

// `message` é obrigatório e admite `undefined` de propósito: com `exactOptionalPropertyTypes`,
// prop opcional obrigaria cada chamada a espalhar um objeto condicional.
function FieldError({ message }: { readonly message: string | undefined }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-500">{message}</p>
}

/**
 * Campo de selecao com rotulo associado por `id`.
 *
 * O `htmlFor` nao e detalhe de conformidade: sem ele o clique no rotulo nao foca o campo — alvo bem
 * maior que a seta — e o leitor de tela anuncia um combo sem nome.
 */
function SelectField({ id, label, value, onChange, error, children }: SelectFieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={id}>{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={SELECT_CLASS}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        />
      </div>
      <FieldError message={error} />
    </div>
  )
}

export function ProductForm({
  onSubmit,
  initialValues,
  catalogs,
  sections,
  onScanBarcode,
  onSearchSuggestions,
}: ProductFormProps) {
  const config = useProductsConfig()
  const isFieldEnabled = useIsProductFieldEnabled(PRODUCT_SURFACE.FORM)
  const isFieldRequired = useIsProductFieldRequired()
  const isFieldVisible = useIsProductFieldVisible(PRODUCT_SURFACE.FORM)
  const label = useProductLabel(PRODUCT_SURFACE.FORM)
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
    unitSize: initialValues?.unitSize ?? '',
    brand: initialValues?.brand ?? '',
    aisle: initialValues?.aisle ?? '',
    aliases: (initialValues?.aliases ?? []).join(', '),
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

  const api = useProducts()
  const uploadImage = api.uploadImage?.bind(api)

  // O upload publica o arquivo e o formulário fica com a URL: é ela que vai para a API do produto e
  // depois para a Meta, que busca a imagem por conta própria.
  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    if (!uploadImage) throw new Error('upload indisponivel')
    const { url } = await uploadImage(file)
    setForm(prev => ({ ...prev, imageUrl: url }))
    return url
  }, [uploadImage])

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
      newErrors.name = `${label(PRODUCT_FIELD.NAME)} é obrigatório`
    }

    if (form.price.amountInCents <= 0) {
      newErrors.price = `${label(PRODUCT_FIELD.PRICE)} deve ser maior que zero`
    }

    for (const [field, stateKey] of TEXT_FIELD_STATE_KEYS) {
      if (!isFieldRequired(field)) continue
      if (form[stateKey].trim()) continue
      newErrors[stateKey] = `${label(field)} é obrigatório`
    }

    // Custo é dinheiro, e "vazio" nele é zero centavo — não string em branco.
    if (isFieldRequired(PRODUCT_FIELD.COST_PRICE) && form.costPrice.amountInCents <= 0) {
      newErrors.costPrice = `${label(PRODUCT_FIELD.COST_PRICE)} é obrigatório`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form, isFieldRequired, label])

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
        // Os quatro de varejo mandam `null` quando ficam vazios, em vez de sumirem do corpo: apagar
        // uma marca errada ou um corredor errado é gesto comum, e omitir a chave manteria o valor
        // antigo — o usuário limparia o campo, salvaria, e veria o texto voltar.
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.BRAND) ? { brand: form.brand.trim() || null } : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.UNIT_SIZE) ? { unitSize: form.unitSize.trim() || null } : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.AISLE) ? { aisle: form.aisle.trim() || null } : {}),
        ...(isFieldEnabled(PRODUCT_OPTIONAL_FIELD.ALIASES)
          ? { aliases: form.aliases.split(',').map((alias) => alias.trim()).filter(Boolean) }
          : {}),
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
  const showBrand = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.BRAND)
  const showUnitSize = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.UNIT_SIZE)
  const showAisle = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.AISLE)
  const showAliases = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.ALIASES)
  const showInventory = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.INVENTORY)
  const showPreparationTime = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.PREPARATION_TIME)
  const showPreparationInstructions = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.PREPARATION_INSTRUCTIONS)
  const showSortOrder = isFieldEnabled(PRODUCT_OPTIONAL_FIELD.SORT_ORDER)
  // Campos do núcleo: aparecem por padrão, e só somem se a tabela por campo mandar.
  const showDescription = isFieldVisible(PRODUCT_FIELD.DESCRIPTION)
  const showCatalog = isFieldVisible(PRODUCT_FIELD.CATALOG)
  const showImage = isFieldVisible(PRODUCT_FIELD.IMAGE)
  const showActive = isFieldVisible(PRODUCT_FIELD.ACTIVE)
  // O asterisco sai do mesmo lugar que a validação: rótulo marcado e campo não exigido (ou o
  // contrário) é o defeito clássico de formulário configurável.
  const labelFor = useCallback(
    (field: ProductField) => `${label(field)}${isFieldRequired(field) ? ' *' : ''}`,
    [label, isFieldRequired],
  )
  const moneyPlaceholder = formatMoney(0, moneyFormat)
  const unitOptions = config.unitOptions ?? DEFAULT_UNIT_OPTIONS
  const marginShortcuts = config.marginShortcutPercents ?? []

  return (
    // `@container` porque os pares de campos abaixo precisam medir a coluna onde o formulario esta,
    // e nao a janela: no painel lateral de 28rem o `md:` da janela (768px) dava duas colunas de 200px
    // dentro de um espaco que so comporta uma, e o codigo de barras nascia cortado.
    <form onSubmit={handleSubmit} className="@container space-y-6">
      <div className="relative">
        <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.NAME)}</label>
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

      {showDescription && (
      <div>
        <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.DESCRIPTION)}</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          className={INPUT_CLASS}
          placeholder="Descrição do produto..."
        />
        <FieldError message={errors.description} />
      </div>
      )}

      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.PRICE)}</label>
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
            <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.COST_PRICE)}</label>
            <input
              type="text"
              value={form.costPrice.text}
              onChange={(e) => handleMoneyChange('costPrice', e.target.value)}
              className={INPUT_CLASS}
              placeholder={moneyPlaceholder}
            />
            <FieldError message={errors.costPrice} />
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

      {(showBrand || showUnitSize) && (
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
          {showBrand && (
            <div>
              <label className={LABEL_CLASS} htmlFor="product-brand">{labelFor(PRODUCT_FIELD.BRAND)}</label>
              <input
                id="product-brand"
                type="text"
                value={form.brand}
                onChange={(e) => updateField('brand', e.target.value)}
                className={INPUT_CLASS}
                placeholder="Piracanjuba"
                maxLength={80}
              />
              <FieldError message={errors.brand} />
            </div>
          )}
          {showUnitSize && (
            <div>
              <label className={LABEL_CLASS} htmlFor="product-unit-size">{labelFor(PRODUCT_FIELD.UNIT_SIZE)}</label>
              <input
                id="product-unit-size"
                type="text"
                value={form.unitSize}
                onChange={(e) => updateField('unitSize', e.target.value)}
                className={INPUT_CLASS}
                placeholder="1L"
                maxLength={40}
              />
              <FieldError message={errors.unitSize} />
            </div>
          )}
        </div>
      )}

      {(showAisle || showAliases) && (
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
          {showAisle && (
            <div>
              <label className={LABEL_CLASS} htmlFor="product-aisle">{labelFor(PRODUCT_FIELD.AISLE)}</label>
              <input
                id="product-aisle"
                type="text"
                value={form.aisle}
                onChange={(e) => updateField('aisle', e.target.value)}
                className={INPUT_CLASS}
                placeholder="Corredor 3"
                maxLength={60}
              />
              <FieldError message={errors.aisle} />
              {/* O que vale é a placa pendurada no corredor: quem separa lê ela, não um código nosso. */}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Como está escrito na placa da loja.
              </p>
            </div>
          )}
          {showAliases && (
            <div>
              <label className={LABEL_CLASS} htmlFor="product-aliases">{labelFor(PRODUCT_FIELD.ALIASES)}</label>
              <input
                id="product-aliases"
                type="text"
                value={form.aliases}
                onChange={(e) => updateField('aliases', e.target.value)}
                className={INPUT_CLASS}
                placeholder="miojo, lámen"
              />
              <FieldError message={errors.aliases} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separados por vírgula. Como o cliente pede o produto.
              </p>
            </div>
          )}
        </div>
      )}

      {(showUnit || showBarcode) && (
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
          {showUnit && (
            <SelectField
              id="product-unit"
              label={labelFor(PRODUCT_FIELD.UNIT)}
              value={form.unit}
              onChange={(value) => updateField('unit', value)}
              error={errors.unit}
            >
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </SelectField>
          )}
          {showBarcode && (
            <div>
              <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.BARCODE)}</label>
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
              <FieldError message={errors.barcode} />
            </div>
          )}
        </div>
      )}

      {(showCatalog || showSection) && (
      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
        {showCatalog && (
        <SelectField
          id="product-catalog"
          label={labelFor(PRODUCT_FIELD.CATALOG)}
          value={form.catalogId}
          onChange={(value) => updateField('catalogId', value)}
          error={errors.catalogId}
        >
          <option value="">Nenhum</option>
          {catalogs.map((catalog) => (
            <option key={catalog.id} value={catalog.id}>{catalog.name}</option>
          ))}
        </SelectField>
        )}
        {showSection && (
          <SelectField
            id="product-section"
            label={labelFor(PRODUCT_FIELD.SECTION)}
            value={form.sectionId}
            onChange={(value) => updateField('sectionId', value)}
            error={errors.sectionId}
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
          </SelectField>
        )}
      </div>
      )}

      {showImage && (
      <div>
        <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.IMAGE)}</label>
        {uploadImage ? (
          <>
            <ImageUpload
              onUpload={handleUploadImage}
              {...(form.imageUrl ? { currentUrl: form.imageUrl } : {})}
            />
            {/* A URL continua editável ao lado do upload: quem já hospeda a foto em outro lugar não
                precisa reenviar o arquivo só para o produto ter imagem. */}
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              className={`${INPUT_CLASS} mt-2`}
              placeholder="https://... (ou envie um arquivo acima)"
              aria-label="URL da imagem"
            />
          </>
        ) : (
          <>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://..."
              aria-label="URL da imagem"
            />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Preview" className="mt-2 w-20 h-20 rounded-lg object-cover bg-gray-100 dark:bg-gray-800" />
            )}
          </>
        )}
        <FieldError message={errors.imageUrl} />
      </div>
      )}

      {(showInventory || showPreparationTime) && (
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
          {showInventory && (
            <div>
              <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.INVENTORY)}</label>
              <input
                type="number"
                value={form.inventory}
                onChange={(e) => updateField('inventory', e.target.value)}
                className={INPUT_CLASS}
                min={0}
              />
              <FieldError message={errors.inventory} />
            </div>
          )}
          {showPreparationTime && (
            <div>
              <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.PREPARATION_TIME)}</label>
              <input
                type="number"
                value={form.preparationTimeMinutes}
                onChange={(e) => updateField('preparationTimeMinutes', e.target.value)}
                className={INPUT_CLASS}
                min={0}
                placeholder="Ex: 15"
              />
              <FieldError message={errors.preparationTimeMinutes} />
            </div>
          )}
        </div>
      )}

      {showSortOrder && (
        <div>
          <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.SORT_ORDER)}</label>
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
          <label className={LABEL_CLASS}>{labelFor(PRODUCT_FIELD.PREPARATION_INSTRUCTIONS)}</label>
          <textarea
            value={form.preparationInstructions}
            onChange={(e) => updateField('preparationInstructions', e.target.value)}
            rows={3}
            className={INPUT_CLASS}
            placeholder="Instruções para quem produz o item..."
          />
          <FieldError message={errors.preparationInstructions} />
        </div>
      )}

      {showActive && (
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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label(PRODUCT_FIELD.ACTIVE)}</span>
      </div>
      )}

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
