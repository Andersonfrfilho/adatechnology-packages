/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Drawer flutuante abaixo de `wide:`, coluna estática acima — mesma armadilha resolvida em
 * `products-ui/workspace/ProductsWorkspace.tsx`: dividir a linha só funciona quando sobra largura
 * para lista e painel ao mesmo tempo. Reutilizado por recursos, serviços e detalhe de reserva —
 * três consumidores é o que justifica extrair o componente em vez de repetir o layout.
 */

import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

export type SidePanelProps = {
  readonly title: string
  readonly closeLabel: string
  readonly onClose: () => void
  readonly headerActions?: ReactNode
  readonly children: ReactNode
}

const BUTTON_CLASS =
  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-11'

export function SidePanel({ title, closeLabel, onClose, headerActions, children }: SidePanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 z-10 bg-gray-900/20 wide:hidden"
      />
      <section
        aria-label={title}
        className="absolute inset-y-0 right-0 z-20 flex w-full max-w-full flex-col bg-white shadow-2xl desktop:w-[28rem] dark:bg-gray-900 wide:static wide:z-auto wide:shrink-0 wide:border-l wide:border-gray-200 wide:shadow-none wide:dark:border-gray-700"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mr-auto">{title}</h2>
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            className={`${BUTTON_CLASS} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800`}
          >
            <X aria-hidden="true" className="w-4 h-4" />
            {closeLabel}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </section>
    </>
  )
}
