/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Campo de código com realce, numeração de linha e laudo do linter.
 *
 * Técnica de sobreposição, e não um editor de verdade: um `<pre>` colorido embaixo e o `<textarea>`
 * transparente em cima, com a MESMA métrica de texto e a rolagem sincronizada. Custa alinhamento
 * milimétrico, e paga não trazendo um CodeMirror (~200KB) para dentro de um pacote de UI que hoje
 * pesa duas dependências — e não perdendo nada do `<textarea>`: seleção, desfazer, corretor,
 * leitor de tela e o cursor que o editor usa para inserir variável continuam nativos.
 */

import { useRef } from 'react'
import type { UIEvent } from 'react'

import { tokenizeHtml } from '../htmlHighlight.util'

export type HtmlCodeFieldProblem = {
  readonly code: string
  readonly severity: string
  readonly message: string
}

export type HtmlCodeFieldProps = {
  readonly value: string
  readonly rows?: number
  readonly onChange: (value: string) => void
  readonly onSelect?: (cursorIndex: number) => void
  readonly onFocus?: () => void
  /** Ausente, nenhum laudo aparece — o campo vira só realce. */
  readonly problems?: readonly HtmlCodeFieldProblem[]
}

export function HtmlCodeField({ value, rows = 12, onChange, onSelect, onFocus, problems }: HtmlCodeFieldProps) {
  const highlightRef = useRef<HTMLPreElement>(null)

  /**
   * O `<pre>` não rola sozinho: ele segue o `<textarea>`. Sem isto, o realce descola do texto no
   * primeiro documento que passa da altura do campo — que é todo documento de e-mail.
   */
  function handleScroll(event: UIEvent<HTMLTextAreaElement>): void {
    const pre = highlightRef.current
    if (!pre) return
    pre.scrollTop = event.currentTarget.scrollTop
    pre.scrollLeft = event.currentTarget.scrollLeft
  }

  const lineCount = value.split('\n').length

  return (
    <div className="adn-code">
      <div className="adn-code__editor">
        <div className="adn-code__gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>

        <div className="adn-code__surface">
          {/* Decorativo: o texto de verdade está no `<textarea>` em cima, e é ele que o leitor de
              tela lê. Anunciar os dois faria o conteúdo aparecer duplicado. */}
          <pre ref={highlightRef} className="adn-code__highlight" aria-hidden="true">
            {tokenizeHtml(value).map((token, index) => (
              <span key={index} className={`adn-code__token adn-code__token--${token.kind}`}>
                {token.text}
              </span>
            ))}
            {/* Linha vazia final: sem ela o realce não acompanha o cursor na última quebra. */}
            {'\n'}
          </pre>

          <textarea
            className="adn-code__input"
            spellCheck={false}
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={handleScroll}
            onSelect={(event) => onSelect?.(event.currentTarget.selectionStart)}
            onFocus={onFocus}
          />
        </div>
      </div>

      {problems && problems.length > 0 && (
        <ul className="adn-settings__email-report">
          {problems.map((problem) => (
            <li
              key={problem.code}
              className={`adn-settings__email-problem adn-settings__email-problem--${problem.severity}`}
            >
              {problem.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
