/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Search, UserPlus } from 'lucide-react'

import { useCustomerSearch } from './useCustomerSearch'
import { useCustomersCapabilities } from './providers/CustomersProvider'
import { formatDate } from './lib/format'
import type { CustomerListItem } from './providers/types'

export type CustomerListProps = {
  readonly onSelect?: (customer: CustomerListItem) => void
  readonly onCreate?: () => void
  readonly perPage?: number
}

const CELL = 'px-3 py-3 text-sm text-gray-700 dark:text-gray-200'
const HEADER = 'px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap'

export function CustomerList({ onSelect, onCreate, perPage }: CustomerListProps) {
  const { customers, total, page, loading, error, setSearch, setPage, reload } = useCustomerSearch(
    perPage === undefined ? {} : { perPage },
  )
  const { canWrite } = useCustomersCapabilities()

  const pageSize = perPage ?? 20
  const lastPage = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px]">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar clientes"
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
        </label>

        {canWrite && onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Novo cliente
          </button>
        ) : null}
      </div>

      {/*
        Falha e vazio são estados DIFERENTES: "nenhum cliente" convida a cadastrar, "não deu para
        carregar" convide a tentar de novo. Trocar um pelo outro faz o operador cadastrar duplicata.
      */}
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Não foi possível carregar os clientes.{' '}
          <button type="button" onClick={reload} className="font-medium underline">
            Tentar de novo
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th scope="col" className={`${HEADER} text-left`}>Nome</th>
              <th scope="col" className={`${HEADER} text-left`}>E-mail</th>
              <th scope="col" className={`${HEADER} text-left`}>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr
                key={customer.id}
                onClick={onSelect ? () => onSelect(customer) : undefined}
                className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : ''} ${
                  onSelect ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-gray-700' : ''
                }`}
              >
                <td className={CELL}>{customer.name ?? <span className="text-gray-400">Sem nome</span>}</td>
                <td className={CELL}>{customer.email ?? ''}</td>
                <td className={CELL}>{formatDate(customer.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !error && customers.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nenhum cliente encontrado.</p>
      ) : null}

      {lastPage > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">
            Anterior
          </button>
          <span className="text-gray-500">
            Página {page} de {lastPage} · {total} clientes
          </span>
          <button type="button" disabled={page >= lastPage} onClick={() => setPage(page + 1)} className="disabled:opacity-40">
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  )
}
