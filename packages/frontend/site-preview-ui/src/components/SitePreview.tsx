/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Prévia do site ao vivo: iframe em escala, Computador/Tablet/Celular, zoom, mão, expandir e tela cheia.
 * A coluna fica fixa ao rolar o formulário (classe `spv-sticky` no `styles.css`).
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import {
  computePreviewScale,
  MAX_ZOOM,
  MIN_ZOOM,
  PREVIEW_DEVICES,
  stepPreviewZoom,
  type PreviewDevice,
  type PreviewZoom,
} from '../host/layout'
import { usePreviewPan } from '../host/usePreviewPan'
import { useSitePreviewChannel } from '../host/useSitePreviewChannel'
import { sitePreviewLabelsPtBr, type SitePreviewLabels } from '../labels'

import { Icon } from './Icon'

const FOCUSABLE = 'button:not(:disabled), a[href]'
const DEVICE_ORDER: readonly PreviewDevice[] = ['desktop', 'tablet', 'mobile']

export type SitePreviewProps = {
  readonly src: string
  readonly payload?: unknown
  readonly focus?: string | undefined
  readonly refreshKey?: string | number | undefined
  readonly channel?: string
  readonly storageKey?: string
  readonly labels?: SitePreviewLabels
  /** Endereço do link "Abrir o site em nova aba"; sem ele o link some. */
  readonly openUrl?: string
  /** Com os dois, mostra "Expandir/Restaurar" (formulário e prévia lado a lado, layout do host). */
  readonly isSplit?: boolean
  readonly onToggleSplit?: () => void
  /** Separador entre o formulário e a prévia, desenhado pelo host. */
  readonly divider?: ReactNode
  /** Tooltip da casa; sem ele o botão só de ícone usa o atributo `title`. */
  readonly renderTooltip?: (text: string, trigger: ReactNode) => ReactNode
}

export function SitePreview(props: SitePreviewProps): ReactNode {
  const {
    src,
    payload,
    focus,
    refreshKey,
    labels = sitePreviewLabelsPtBr,
    openUrl,
    isSplit = false,
    onToggleSplit,
    divider,
    renderTooltip,
  } = props
  const rootRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [zoom, setZoom] = useState<PreviewZoom>('fit')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [stage, setStage] = useState<{ width: number; height: number }>({
    width: PREVIEW_DEVICES.desktop.width,
    height: 600,
  })
  const frameWidth = PREVIEW_DEVICES[device].width
  const scale = computePreviewScale({ zoom, device, stageWidth: stage.width })
  const percent = Math.round(scale * 100)
  const frameHeight = Math.max(stage.height / scale, 200)
  const pan = usePreviewPan({ stageRef, frameRef, scale })
  useSitePreviewChannel({
    frameRef,
    payload,
    focus,
    refreshKey,
    ...(props.channel === undefined ? {} : { channel: props.channel }),
    ...(props.storageKey === undefined ? {} : { storageKey: props.storageKey }),
  })

  function withTooltip(text: string, trigger: ReactNode): ReactNode {
    return renderTooltip === undefined ? trigger : renderTooltip(text, trigger)
  }

  function handleClose(): void {
    setIsFullscreen(false)
    shouldRestoreFocusRef.current = true
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (!isFullscreen) return
    if (event.key === 'Escape') {
      event.stopPropagation()
      handleClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    const first = items[0]
    const last = items[items.length - 1]
    if (first === undefined || last === undefined) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    const element = stageRef.current
    if (element === null) return undefined
    const observer = new ResizeObserver(() => setStage({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    setStage({ width: element.clientWidth, height: element.clientHeight })
    return () => observer.disconnect()
  }, [isFullscreen, isSplit])

  useEffect(() => {
    if (isFullscreen || !shouldRestoreFocusRef.current) return
    shouldRestoreFocusRef.current = false
    openRef.current?.focus()
  }, [isFullscreen])

  useEffect(() => {
    if (!isFullscreen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previous
    }
  }, [isFullscreen])

  const deviceLabels: Record<PreviewDevice, string> = {
    desktop: labels.desktop,
    tablet: labels.tablet,
    mobile: labels.mobile,
  }
  const iconButton = (label: string, name: 'minus' | 'plus', isDisabled: boolean, direction: -1 | 1): ReactNode =>
    withTooltip(
      label,
      <button
        type="button"
        className="spv-button is-icon"
        aria-label={label}
        title={renderTooltip === undefined ? label : undefined}
        disabled={isDisabled}
        onClick={() => setZoom(stepPreviewZoom(percent, direction))}
      >
        <Icon name={name} />
      </button>,
    )

  return (
    <>
      {isFullscreen ? null : (
        <button type="button" ref={openRef} className="spv-button spv-open" onClick={() => setIsFullscreen(true)}>
          <Icon name="expand" />
          {labels.open}
        </button>
      )}
      {isFullscreen ? <div className="spv-scrim" onClick={handleClose} aria-hidden="true" /> : null}
      {isSplit && !isFullscreen ? divider : null}
      <aside
        ref={rootRef}
        className={isFullscreen ? 'spv-root spv-sticky is-expanded' : 'spv-root spv-sticky'}
        aria-label={labels.title}
        role={isFullscreen ? 'dialog' : undefined}
        aria-modal={isFullscreen ? true : undefined}
        onKeyDown={handleKeyDown}
      >
        <div className="spv-bar">
          <h2>{labels.title}</h2>
          <div className="spv-group" role="group" aria-label={labels.deviceGroup}>
            {DEVICE_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                className={device === name ? 'spv-button is-active' : 'spv-button'}
                aria-pressed={device === name}
                onClick={() => setDevice(name)}
              >
                {deviceLabels[name]}
              </button>
            ))}
          </div>
        </div>
        <div className="spv-tools">
          <div className="spv-group spv-zoom" role="group" aria-label={labels.zoomGroup}>
            {iconButton(labels.zoomOut, 'minus', percent <= MIN_ZOOM, -1)}
            <output className="spv-percent" aria-live="polite">
              {percent}%
            </output>
            {iconButton(labels.zoomIn, 'plus', percent >= MAX_ZOOM, 1)}
            <button type="button" className="spv-button" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>
              {labels.fit}
            </button>
            {withTooltip(
              labels.handHint,
              <button
                type="button"
                className={pan.isHandOn ? 'spv-button is-active' : 'spv-button'}
                aria-pressed={pan.isHandOn}
                onClick={pan.toggleHand}
              >
                <Icon name="hand" />
                {labels.hand}
              </button>,
            )}
          </div>
          {isFullscreen ? (
            <button type="button" ref={closeRef} className="spv-button" onClick={handleClose}>
              <Icon name="close" />
              {labels.close}
            </button>
          ) : onToggleSplit === undefined ? null : (
            <button type="button" className="spv-button spv-split" aria-pressed={isSplit} onClick={onToggleSplit}>
              <Icon name={isSplit ? 'split' : 'expand'} />
              {isSplit ? labels.restore : labels.expand}
            </button>
          )}
        </div>
        <div className="spv-stage" ref={stageRef}>
          <div className="spv-sizer" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
            <iframe
              ref={frameRef}
              className="spv-frame"
              title={labels.title}
              src={src}
              style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
            />
            {pan.isHandOn ? (
              <div
                className={pan.isPanning ? 'spv-pan is-panning' : 'spv-pan'}
                aria-hidden="true"
                {...pan.overlayHandlers}
              />
            ) : null}
          </div>
        </div>
        {openUrl === undefined ? null : (
          <a className="spv-button" href={openUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="external" />
            {labels.openInNewTab}
          </a>
        )}
      </aside>
    </>
  )
}
