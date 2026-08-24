/**
 * Camada única de dicas do pacote.
 *
 * O `title` nativo existia em todos os botões e mesmo assim a dica "não aparecia": o navegador
 * espera de 1 a 2 segundos antes de desenhar, o balão sai fora do tema e some ao menor movimento do
 * mouse. Aqui a dica é do produto — aparece em 120ms, com o mesmo contraste do resto da interface.
 *
 * Um só ouvinte no documento atende a interface inteira: cada botão declara `data-cv-tooltip` e não
 * precisa de estado, ref ou wrapper próprio. O balão é impresso em `document.body` via portal
 * porque `overflow` de container (a régua de respostas rápidas rola na horizontal) recortaria um
 * balão desenhado dentro do próprio botão.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Atributo que marca um elemento como portador de dica. */
export const TOOLTIP_ATTRIBUTE = 'data-cv-tooltip'

const TOOLTIP_DELAY_MS = 120
const TOOLTIP_GAP_PX = 8
/** Margem para o balão não colar na borda da janela quando o alvo está no canto. */
const TOOLTIP_EDGE_PX = 72

export type TooltipPlacement = 'top' | 'bottom'

export interface TooltipPositionParams {
  readonly targetRect: { top: number; bottom: number; left: number; width: number }
  readonly viewportWidth: number
}

export interface TooltipPosition {
  left: number
  top: number
  placement: TooltipPlacement
}

interface TooltipState extends TooltipPosition {
  text: string
}

/** Separado do componente por ser a única parte com regra: o resto é ouvir evento e desenhar. */
export function tooltipPositionOf({ targetRect, viewportWidth }: TooltipPositionParams): TooltipPosition {
  // Sem espaço acima (botão no topo da tela), o balão desce em vez de sair da janela.
  const placement: TooltipPlacement = targetRect.top < TOOLTIP_EDGE_PX ? 'bottom' : 'top'
  const centerX = targetRect.left + targetRect.width / 2

  return {
    left: Math.min(Math.max(centerX, TOOLTIP_EDGE_PX), viewportWidth - TOOLTIP_EDGE_PX),
    top: placement === 'top' ? targetRect.top - TOOLTIP_GAP_PX : targetRect.bottom + TOOLTIP_GAP_PX,
    placement,
  }
}

function tooltipStateFor(target: Element, text: string): TooltipState {
  const position = tooltipPositionOf({
    targetRect: target.getBoundingClientRect(),
    viewportWidth: window.innerWidth,
  })

  return { text, ...position }
}

/**
 * Só uma camada desenha por vez. A camada é montada por cada superfície do pacote (inbox, fluxos,
 * documentos) para o host não precisar montá-la à mão; duas superfícies na mesma tela renderizariam
 * dois balões sobrepostos sem essa trava.
 */
let layerOwner: object | undefined

export function TooltipLayer() {
  const identity = useRef({})
  const [isOwner, setIsOwner] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | undefined>(undefined)

  useEffect(() => {
    const owned = identity.current
    if (layerOwner && layerOwner !== owned) return undefined
    layerOwner = owned
    setIsOwner(true)

    return () => {
      if (layerOwner === owned) layerOwner = undefined
    }
  }, [])

  useEffect(() => {
    if (!isOwner) return undefined

    let timer: ReturnType<typeof setTimeout> | undefined

    function cancelPending() {
      if (timer) clearTimeout(timer)
      timer = undefined
    }

    function hide() {
      cancelPending()
      setTooltip(undefined)
    }

    function handleEnter(event: Event) {
      const origin = event.target
      if (!(origin instanceof Element)) return
      // `Element`, e não `HTMLElement`: ícone é `<svg>`, que não é HTMLElement. Exigir HTMLElement
      // fazia a dica de um ícone não só falhar — ela ENGOLIA a do card ao redor, porque o
      // `closest` já tinha parado no svg e a busca não continuava para cima.
      const target = origin.closest(`[${TOOLTIP_ATTRIBUTE}]`)
      if (!target) {
        hide()
        return
      }
      const text = target.getAttribute(TOOLTIP_ATTRIBUTE)
      if (!text) {
        hide()
        return
      }
      cancelPending()
      timer = setTimeout(() => setTooltip(tooltipStateFor(target, text)), TOOLTIP_DELAY_MS)
    }

    // Sair da janela não dispara `pointerover` em elemento nenhum: sem isto, o balão ficaria aceso
    // depois que o ponteiro já saiu da página.
    function handleLeaveWindow(event: PointerEvent) {
      if (!event.relatedTarget) hide()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') hide()
    }

    document.addEventListener('pointerover', handleEnter)
    document.addEventListener('pointerout', handleLeaveWindow)
    document.addEventListener('focusin', handleEnter)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', handleKeyDown)
    // Captura: rolagem em qualquer container interno invalida a posição já medida.
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)

    return () => {
      cancelPending()
      document.removeEventListener('pointerover', handleEnter)
      document.removeEventListener('pointerout', handleLeaveWindow)
      document.removeEventListener('focusin', handleEnter)
      document.removeEventListener('pointerdown', hide)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [isOwner])

  if (!tooltip) return null

  return createPortal(
    <div
      role="tooltip"
      className={`cv-tooltip cv-tooltip--${tooltip.placement}`}
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.text}
    </div>,
    document.body,
  )
}
