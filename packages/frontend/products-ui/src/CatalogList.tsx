import { useState, useEffect, useCallback, type FormEvent } from 'react'
import type { Catalog, ProductsApi } from './providers/types'
import { useProducts } from './providers/ProductsProvider'

export interface CatalogListProps {
  api?: ProductsApi
}

interface EditingCatalog {
  id: string
  name: string
  description: string
  active: boolean
}

export function CatalogList({ api }: CatalogListProps) {
  const contextApi = useProducts()
  const resolvedApi = api ?? contextApi

  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingCatalog | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

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
      })
      setNewName('')
      setNewDescription('')
      setCreating(false)
      await loadCatalogs()
    } catch {
      setError('Erro ao criar catálogo')
    } finally {
      setSubmitting(false)
    }
  }, [newName, newDescription, resolvedApi, loadCatalogs])

  const handleUpdate = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !editing.name.trim()) return
    setSubmitting(true)
    try {
      await resolvedApi.updateCatalog(editing.id, {
        name: editing.name.trim(),
        description: editing.description.trim() || undefined,
        active: editing.active,
      })
      setEditing(null)
      await loadCatalogs()
    } catch {
      setError('Erro ao atualizar catálogo')
    } finally {
      setSubmitting(false)
    }
  }, [editing, resolvedApi, loadCatalogs])

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

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          {catalogs.length} catálogo{catalogs.length !== 1 ? 's' : ''}
        </h3>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setEditing(null) }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            + Novo catálogo
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="mb-4 p-4 border border-brand-200 rounded-lg bg-brand-50">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Novo catálogo</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do catálogo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Produtos</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ativo</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {catalogs.map((catalog) => (
              <tr key={catalog.id} className="hover:bg-gray-50 transition-colors">
                {editing?.id === catalog.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editing.description}
                        onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-gray-500">{catalog.productCount ?? '—'}</td>
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
                          className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-3 font-medium text-gray-900">{catalog.name}</td>
                    <td className="px-3 py-3 text-gray-500 max-w-[200px] truncate">
                      {catalog.description ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {catalog.productCount ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {catalog.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sim</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Não</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => startEdit(catalog)}
                          className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
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
                <td colSpan={5} className="px-3 py-12 text-center text-gray-500 text-sm">
                  Nenhum catálogo criado ainda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
