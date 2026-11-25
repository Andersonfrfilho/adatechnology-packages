/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Compartilhamento por URL simples das redes: nenhum script de terceiro entra na página, nada de
 * rastreamento carregado só por abrir o post.
 */

export const SHARE_NETWORK = {
  WHATSAPP: 'whatsapp',
  FACEBOOK: 'facebook',
  X: 'x',
  LINKEDIN: 'linkedin',
} as const
export type ShareNetwork = (typeof SHARE_NETWORK)[keyof typeof SHARE_NETWORK]

export const SHARE_NETWORKS: readonly ShareNetwork[] = Object.values(SHARE_NETWORK)

export type ShareLink = { readonly network: ShareNetwork; readonly href: string }

export function buildShareLinks(params: { readonly url: string; readonly title: string }): readonly ShareLink[] {
  const url = encodeURIComponent(params.url)
  const text = encodeURIComponent(params.title)
  return [
    {
      network: SHARE_NETWORK.WHATSAPP,
      href: `https://wa.me/?text=${encodeURIComponent(`${params.title} ${params.url}`)}`,
    },
    { network: SHARE_NETWORK.FACEBOOK, href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { network: SHARE_NETWORK.X, href: `https://x.com/intent/post?url=${url}&text=${text}` },
    { network: SHARE_NETWORK.LINKEDIN, href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
  ]
}
