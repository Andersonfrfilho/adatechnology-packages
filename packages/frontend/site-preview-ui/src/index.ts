/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Entrada `@adatechnology/site-preview-ui`: lado do painel (host). O lado do site está em `/guest`.
 */

export { SitePreview } from './components/SitePreview'
export type { SitePreviewProps } from './components/SitePreview'
export { useSitePreviewChannel } from './host/useSitePreviewChannel'
export type { UseSitePreviewChannelParams } from './host/useSitePreviewChannel'
export { usePreviewPan } from './host/usePreviewPan'
export { readPreviewScroll, writePreviewScroll } from './host/scrollMemory'
export { computePreviewScale, stepPreviewZoom, MAX_ZOOM, MIN_ZOOM, PREVIEW_DEVICES, ZOOM_STEP } from './host/layout'
export type { PreviewDevice, PreviewScaleParams, PreviewZoom } from './host/layout'
export { sitePreviewLabelsEn, sitePreviewLabelsPtBr } from './labels'
export type { SitePreviewLabels } from './labels'
export {
  DEFAULT_PREVIEW_CHANNEL,
  PREVIEW_PROTOCOL_VERSION,
  PREVIEW_SECTION_ATTRIBUTE,
  parseGuestMessage,
  parseHostMessage,
  wrapGuestMessage,
  wrapHostMessage,
} from './protocol'
export type { GuestMessage, HostMessage } from './protocol'
