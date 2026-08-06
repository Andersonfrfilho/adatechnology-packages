/**
 * Menu interativo do WhatsApp — botões de resposta rápida e lista de opções.
 *
 * A mensagem é gravada com o payload cru que foi enviado à Meta, então a UI apenas o desenha; não
 * há segunda fonte de verdade sobre quais opções existiam naquele momento. Sem isto, mensagem
 * `interactive` aparecia como texto solto e o menu simplesmente sumia da conversa — inclusive no
 * simulador, onde o operador precisa ver exatamente o que o cliente vê.
 *
 * `onSelect` é opcional de propósito: no histórico da inbox as opções são leitura (o operador não
 * responde no lugar do cliente); no simulador elas são clicáveis.
 */

import { useState } from 'react'
import type { InteractiveOption, InteractivePayload, InteractiveSelection } from './types'
import { cn } from './lib/cn'
import { parseWhatsAppFormatting } from './lib/whatsapp-formatting'

/** `parseWhatsAppFormatting` emite `<strong>`/`<em>`/`<del>`, que o reset do Tailwind zera. */
const FORMATTING_CLASSES = '[&_strong]:font-bold [&_em]:italic [&_del]:line-through'

export interface InteractiveMessageLabels {
  /** Fallback do rótulo do botão que abre a lista, quando o payload não traz um. */
  openList: string
}

export const DEFAULT_INTERACTIVE_MESSAGE_LABELS: InteractiveMessageLabels = {
  openList: 'Ver opções',
}

export interface InteractiveMessageProps {
  payload: InteractivePayload
  onSelect?: (selection: InteractiveSelection) => void
  labels?: Partial<InteractiveMessageLabels>
  className?: string
}

function collectRows(payload: InteractivePayload): InteractiveOption[] {
  return (payload.action?.sections ?? []).flatMap((section) => section.rows ?? [])
}

function collectButtons(payload: InteractivePayload): InteractiveOption[] {
  return (payload.action?.buttons ?? [])
    .map((button) => button.reply)
    .filter((reply): reply is InteractiveOption => reply !== undefined)
}

export function InteractiveMessage({ payload, onSelect, labels, className }: InteractiveMessageProps) {
  const openListLabel = labels?.openList ?? DEFAULT_INTERACTIVE_MESSAGE_LABELS.openList
  const [isListOpen, setIsListOpen] = useState(false)

  const buttons = collectButtons(payload)
  const sections = payload.action?.sections ?? []
  const hasRows = collectRows(payload).length > 0
  const isInteractable = onSelect !== undefined

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Cabeçalho, corpo e rodapé passam pela formatação do WhatsApp — o aparelho renderiza
          `*negrito*` neles como em qualquer texto. Título e descrição de opção NÃO: ali o WhatsApp
          mostra os asteriscos literais, e formatá-los aqui deixaria o simulador mais bonito que o
          aparelho, que é o tipo de divergência que só aparece com o cliente na frente. */}
      {payload.header?.text ? (
        <p className={cn('text-sm font-semibold text-gray-900 dark:text-gray-100', FORMATTING_CLASSES)}>
          {parseWhatsAppFormatting(payload.header.text)}
        </p>
      ) : null}

      {payload.body?.text ? (
        <p
          className={cn(
            'whitespace-pre-wrap break-words text-sm text-gray-900 dark:text-gray-100',
            FORMATTING_CLASSES,
          )}
        >
          {parseWhatsAppFormatting(payload.body.text)}
        </p>
      ) : null}

      {payload.footer?.text ? (
        <p className={cn('text-xs text-gray-500 dark:text-gray-400', FORMATTING_CLASSES)}>
          {parseWhatsAppFormatting(payload.footer.text)}
        </p>
      ) : null}

      {buttons.length > 0 ? (
        <div className="mt-1 flex flex-col gap-1 border-t border-gray-200 pt-1 dark:border-gray-700">
          {buttons.map((button) => (
            <button
              data-cv-tooltip={button.title} aria-label={button.title}
              key={button.id}
              type="button"
              disabled={!isInteractable}
              onClick={() => onSelect?.({ kind: 'button', option: button })}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors enabled:hover:bg-teal-50 disabled:cursor-default dark:text-teal-300 dark:enabled:hover:bg-teal-900/30"
            >
              {button.title}
            </button>
          ))}
        </div>
      ) : null}

      {hasRows ? (
        <div className="mt-1 border-t border-gray-200 pt-1 dark:border-gray-700">
          <button
            data-cv-tooltip={payload.action?.button ?? openListLabel} aria-label={payload.action?.button ?? openListLabel}
            type="button"
            onClick={() => setIsListOpen((open) => !open)}
            aria-expanded={isListOpen}
            className="w-full rounded-md px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-900/30"
          >
            ☰ {payload.action?.button ?? openListLabel}
          </button>

          {isListOpen ? (
            <div className="mt-1 flex flex-col gap-1">
              {sections.map((section, sectionIndex) => (
                <div key={section.title ?? sectionIndex} className="flex flex-col">
                  {section.title ? (
                    <p className="px-3 py-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      {section.title}
                    </p>
                  ) : null}
                  {(section.rows ?? []).map((row) => (
                    <button
                      data-cv-tooltip={row.title} aria-label={row.title}
                      key={row.id}
                      type="button"
                      disabled={!isInteractable}
                      onClick={() => onSelect?.({ kind: 'list', option: row })}
                      className="rounded-md px-3 py-1.5 text-left text-sm text-gray-900 transition-colors enabled:hover:bg-gray-100 disabled:cursor-default dark:text-gray-100 dark:enabled:hover:bg-gray-700"
                    >
                      <span className="block">{row.title}</span>
                      {row.description ? (
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{row.description}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
