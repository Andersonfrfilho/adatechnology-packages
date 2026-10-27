/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Vazio, carregando e falha — os três estados que toda área desta tela atravessa. Estavam
 * repetidos como parágrafo solto em cinco arquivos, e o de erro usava `bg-red-50` sem variante
 * escura: no tema escuro o aviso saía texto vermelho sobre fundo quase branco.
 */

import { AlertTriangle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { SURFACE_BORDER } from './ui.constant'

export type ErrorBannerProps = {
  readonly message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  )
}

export type EmptyStateProps = {
  readonly icon: LucideIcon
  readonly title: string
  readonly hint?: string
  readonly action?: ReactNode
}

export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className={`${SURFACE_BORDER} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {hint && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export type SkeletonProps = {
  readonly label: string
  readonly rows?: number
}

const SKELETON_ROW = 'h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800'

/** `aria-busy` + rótulo porque a barra cinza não diz nada a quem ouve a tela. */
export function ListSkeleton({ label, rows = 5 }: SkeletonProps) {
  return (
    <div aria-busy="true" aria-label={label} role="status" className="space-y-2">
      {Array.from({ length: rows }, (_row, index) => (
        <div key={index} className={SKELETON_ROW} />
      ))}
    </div>
  )
}

export function BlockSkeleton({ label }: { readonly label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      role="status"
      className="min-h-64 flex-1 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
    />
  )
}
