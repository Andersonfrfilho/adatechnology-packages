/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type SitePreviewLabels = {
  readonly title: string
  readonly deviceGroup: string
  readonly desktop: string
  readonly tablet: string
  readonly mobile: string
  readonly zoomGroup: string
  readonly zoomOut: string
  readonly zoomIn: string
  readonly fit: string
  readonly hand: string
  readonly handHint: string
  readonly open: string
  readonly close: string
  readonly expand: string
  readonly restore: string
  readonly openInNewTab: string
}

export const sitePreviewLabelsPtBr: SitePreviewLabels = {
  title: 'Prévia do site',
  deviceGroup: 'Tamanho da tela',
  desktop: 'Computador',
  tablet: 'Tablet',
  mobile: 'Celular',
  zoomGroup: 'Zoom da prévia',
  zoomOut: 'Diminuir zoom',
  zoomIn: 'Aumentar zoom',
  fit: 'Ajustar',
  hand: 'Mão',
  handHint: 'Arrastar a prévia para os lados (ou Shift + roda do mouse)',
  open: 'Ver prévia',
  close: 'Fechar',
  expand: 'Expandir',
  restore: 'Restaurar',
  openInNewTab: 'Abrir o site em nova aba',
}

export const sitePreviewLabelsEn: SitePreviewLabels = {
  title: 'Site preview',
  deviceGroup: 'Screen size',
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Phone',
  zoomGroup: 'Preview zoom',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  fit: 'Fit',
  hand: 'Hand',
  handHint: 'Drag the preview sideways (or Shift + mouse wheel)',
  open: 'Open preview',
  close: 'Close',
  expand: 'Expand',
  restore: 'Restore',
  openInNewTab: 'Open the site in a new tab',
}
