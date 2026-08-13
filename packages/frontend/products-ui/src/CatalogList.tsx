import { Folder, FolderOpen, FolderX, Layers, Pencil, Plus } from 'lucide-react'
import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { PRODUCT_SYNC_STATUS, type Catalog, type ProductSyncStatus, type ProductsApi } from './providers/types'
import { useProducts, useProductsConfig } from './providers/ProductsProvider'

// Id sintético da entrada "sem catálogo". Não é um catálogo real: existe para que a tela consiga
// filtrar os produtos órfãos, que de outro modo só apareceriam na visão "todos".
export const CATALOG_NONE = '__none__'

export type CatalogListProps = {
  readonly api?: ProductsApi
  // `table` é o CRUD completo; `sidebar` é o painel de navegação que filtra outra lista.
  readonly variant?: 'table' | 'sidebar'
  // Seleção controlada pelo host: `null` = "todos", `CATALOG_NONE` = "sem catálogo".
  readonly selectedId?: string | null
  readonly onSelect?: (catalogId: string | null) => void
  readonly showNoneOption?: boolean
  readonly noneCount?: number
  readonly showSortOrder?: boolean
}

// A altura mínima é a área de toque de 44px da regra de responsividade: a barra vira lista rolável
// no celular, e item de 32px ali erra o dedo.
const SIDEBAR_ITEM_CLASS =
  'w-full flex items-center gap-2 min-h-11 px-2 py-2 rounded-lg text-sm text-left transition-colors'
const SIDEBAR_ITEM_ACTIVE =
  'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 font-medium'
const SIDEBAR_ITEM_IDLE =
  'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
// `tabular-nums` para a coluna de contagem não dançar entre 9 e 10.
const SIDEBAR_COUNT_CLASS =
  'shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400 min-w-4 text-right'

type EditingCatalog = {
  id: string
  name: string
  description: string
  active: boolean
  sortOrder: string
}

const SYNC_LABEL: Record<ProductSyncStatus, { text: string; dot: string }> = {
  [PRODUCT_SYNC_STATUS.PENDING]: { text: 'Aguardando envio à Meta', dot: 'bg-amber-400' },
  [PRODUCT_SYNC_STATUS.SYNCED]: { text: 'Publicado na Meta', dot: 'bg-green-500' },
  [PRODUCT_SYNC_STATUS.FAILED]: { text: 'Falha ao publicar na Meta', dot: 'bg-red-500' },
}

// `status: null` = o host não sincroniza este item; nada é desenhado, para não sugerir pendência.
function SyncDot({ status, error }: { readonly status: ProductSyncStatus | null; readonly error: string | null }) {
  if (!status) return null
  const { text, dot } = SYNC_LABEL[status]
  return (
    <span
      title={error ?? text}
      aria-label={error ?? text}
      className={`inline-block w-2 h-2 rounded-full align-middle ${dot}`}
    />
  )
}

export function CatalogList({
  api,
  variant = 'table',
  selectedId = null,
  onSelect,
  showNoneOption = false,
  noneCount,
  showSortOrder = false,
}: CatalogListProps) {
  const contextApi = useProducts()
  const config = useProductsConfig()
  const resolvedApi = api ?? contextApi
  const showSyncStatus = config.metaSync?.catalogs === true

  const [catalogs, setCatalogs] = useState<readonly Catalog[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingCatalog | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('0')

  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await resolvedApi.listCatalogs()
      setCatalogs(result.data)
    } catch {
      setError('Erro ao carregar catálogos')
    } finally {
      setLoading(false)
    }
  }, [resolvedApi])

  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  const handleCreate = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSubmitting(true)
    try {
      await resolvedApi.createCatalog({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        ...(showSortOrder ? { sortOrder: Number.parseInt(newSortOrder, 10) || 0 } : {}),
      })
      setNewName('')
      setNewDescription('')
      setNewSortOrder('0')
      setCreating(false)
      await loadCatalogs()
    } catch {
      setError('Erro ao criar catálogo')
    } finally {
      setSubmitting(false)
    }
  }, [newName, newDescription, newSortOrder, showSortOrder, resolvedApi, loadCatalogs])

  const handleUpdate = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !editing.name.trim()) return
    setSubmitting(true)
    try {
      await resolvedApi.updateCatalog(editing.id, {
        name: editing.name.trim(),
        description: editing.description.trim() || undefined,
        active: editing.active,
        ...(showSortOrder ? { sortOrder: Number.parseInt(editing.sortOrder, 10) || 0 } : {}),
      })
      setEditing(null)
      await loadCatalogs()
    } catch {
      setError('Erro ao atualizar catálogo')
    } finally {
      setSubmitting(false)
    }
  }, [editing, showSortOrder, resolvedApi, loadCatalogs])

  const handleDelete = useCallback(async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id)
      return
    }
    setSubmitting(true)
    try {
      await resolvedApi.deleteCatalog(id)
      setDeletingId(null)
      await loadCatalogs()
    } catch {
      setError('Erro ao excluir catálogo')
    } finally {
      setSubmitting(false)
    }
  }, [deletingId, resolvedApi, loadCatalogs])

  const startEdit = useCallback((catalog: Catalog) => {
    setEditing({
      id: catalog.id,
      name: catalog.name,
      description: catalog.description ?? '',
      active: catalog.active,
      sortOrder: (catalog.sortOrder ?? 0).toString(),
    })
    setCreating(false)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditing(null)
    setDeletingId(null)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {/* Na barra lateral o cabeçalho é rótulo de seção, não título de tela: um botão primário azul
          num painel de 16rem competiria com "Novo produto", que é a ação principal da área. */}
      {variant === 'sidebar' ? (
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Layers aria-hidden="true" className="w-4 h-4" />
            Catálogos
            <span className="tabular-nums font-normal text-gray-400 dark:text-gray-500">{catalogs.length}</span>
          </h3>
          {!creating && (
            <button
              type="button"
              onClick={() => { setCreating(true); setEditing(null) }}
              aria-label="Novo catálogo"
              title="Novo catálogo"
              className="inline-flex items-center justify-center w-11 h-11 -my-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {catalogs.length} catálogo{catalogs.length !== 1 ? 's' : ''}
          </h3>
          {!creating && (
            <button
              onClick={() => { setCreating(true); setEditing(null) }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
              Novo catálogo
            </button>
          )}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="mb-4 p-4 border border-brand-200 rounded-lg bg-brand-50">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Novo catálogo</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do catálogo"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {showSortOrder && (
              <input
                type="number"
                min="0"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                placeholder="Ordem de exibição"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !newName.trim()}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </form>
      )}

      {variant === 'sidebar' && (
        <nav className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelect?.(null)}
            aria-current={selectedId === null ? 'true' : undefined}
            className={`${SIDEBAR_ITEM_CLASS} ${selectedId === null ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE}`}
          >
            <Layers aria-hidden="true" className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Todos</span>
          </button>

          {catalogs.map((catalog) => {
            const selected = selectedId === catalog.id
            const FolderIcon = selected ? FolderOpen : Folder

            return (
              <div key={catalog.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect?.(catalog.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`${SIDEBAR_ITEM_CLASS} pr-10 ${selected ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE}`}
                >
                  <FolderIcon aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span className={`flex-1 truncate ${catalog.active ? '' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                    {catalog.name}
                  </span>
                  {showSyncStatus && <SyncDot status={catalog.syncStatus ?? null} error={catalog.syncError ?? null} />}
                  {catalog.productCount !== undefined && (
                    <span className={SIDEBAR_COUNT_CLASS}>{catalog.productCount}</span>
                  )}
                </button>
                {/* Fora do botão de seleção: botão dentro de botão é HTML inválido, e o clique em
                    "editar" não pode arrastar a lista para outro filtro pelo caminho. */}
                <button
                  type="button"
                  onClick={() => startEdit(catalog)}
                  aria-label={`Editar ${catalog.name}`}
                  title={`Editar ${catalog.name}`}
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-200/70 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-opacity"
                >
                  <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}

          {/* Órfãos não são um catálogo: a linha divisória diz isso sem precisar de itálico, que aqui
              só deixava o rótulo mais difícil de ler do que os vizinhos. */}
          {showNoneOption && (
            <button
              type="button"
              onClick={() => onSelect?.(CATALOG_NONE)}
              aria-current={selectedId === CATALOG_NONE ? 'true' : undefined}
              className={`${SIDEBAR_ITEM_CLASS} mt-2 border-t border-gray-200 dark:border-gray-700 rounded-t-none pt-3 ${
                selectedId === CATALOG_NONE ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_IDLE
              }`}
            >
              <FolderX aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">Sem catálogo</span>
              {noneCount !== undefined && <span className={SIDEBAR_COUNT_CLASS}>{noneCount}</span>}
            </button>
          )}

          {editing && (
            <form onSubmit={handleUpdate} className="mt-3 p-3 border border-brand-200 rounded-lg bg-brand-50 space-y-2">
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {showSortOrder && (
                <input
                  type="number"
                  min="0"
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Ativo
              </label>
              <div className="flex gap-1 justify-between">
                <button
                  type="button"
                  onClick={() => handleDelete(editing.id)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    deletingId === editing.id ? 'text-white bg-red-500 hover:bg-red-600' : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  {deletingId === editing.id ? 'Confirmar exclusão' : 'Excluir'}
                </button>
                <span className="flex gap-1">
                  <button type="button" onClick={cancelEdit} className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3 py-1 text-xs font-medium rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </span>
              </div>
            </form>
          )}
        </nav>
      )}

      {/* Table */}
      {variant === 'table' && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descrição</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produtos</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ativo</th>
              {showSyncStatus && (
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Meta</th>
              )}
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {catalogs.map((catalog) => (
              <tr key={catalog.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                {editing?.id === catalog.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editing.description}
                        onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">{catalog.productCount ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editing.active}
                          onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-600" />
                      </label>
                    </td>
                    {showSyncStatus && (
                      <td className="px-3 py-2 text-center">
                        <SyncDot status={catalog.syncStatus ?? null} error={catalog.syncError ?? null} />
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={handleUpdate}
                          disabled={submitting}
                          className="px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded transition-colors"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">{catalog.name}</td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {catalog.description ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">
                      {catalog.productCount ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {catalog.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sim</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Não</span>
                      )}
                    </td>
                    {showSyncStatus && (
                      <td className="px-3 py-3 text-center">
                        <SyncDot status={catalog.syncStatus ?? null} error={catalog.syncError ?? null} />
                      </td>
                    )}
                    <td className="px-3 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => startEdit(catalog)}
                          className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(catalog.id)}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            deletingId === catalog.id
                              ? 'text-white bg-red-500 hover:bg-red-600'
                              : 'text-red-500 hover:bg-red-50'
                          }`}
                        >
                          {deletingId === catalog.id ? 'Confirmar' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {catalogs.length === 0 && (
              <tr>
                <td colSpan={showSyncStatus ? 6 : 5} className="px-3 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Nenhum catálogo criado ainda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
