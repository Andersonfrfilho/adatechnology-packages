/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Check, Link2, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { buildShareLinks, SHARE_NETWORK, type ShareNetwork } from '../lib/share'
import type { ContentMessages } from '../locales'
import { useContentText } from '../providers/ContentProvider'

const NETWORK_LABEL: Record<ShareNetwork, keyof ContentMessages> = {
  [SHARE_NETWORK.WHATSAPP]: 'shareWhatsApp',
  [SHARE_NETWORK.FACEBOOK]: 'shareFacebook',
  [SHARE_NETWORK.X]: 'shareX',
  [SHARE_NETWORK.LINKEDIN]: 'shareLinkedIn',
}

const COPIED_FEEDBACK_MS = 2000

export type ShareButtonsProps = {
  readonly url: string
  readonly title: string
  /** Redes exibidas, na ordem. Padrão: todas. */
  readonly networks?: readonly ShareNetwork[]
}

export function ShareButtons({ url, title, networks }: ShareButtonsProps) {
  const { messages, format } = useContentText()
  const [isCopied, setIsCopied] = useState(false)
  const links = buildShareLinks({ url, title }).filter((link) => !networks || networks.includes(link.network))
  // Decidido depois de montar: no servidor não há `navigator`, e decidir no render faria o HTML do
  // servidor divergir do primeiro render do cliente (erro de hidratação).
  const [capabilities, setCapabilities] = useState({ canShareNatively: false, canCopy: false })
  useEffect(() => {
    setCapabilities({
      canShareNatively: typeof navigator.share === 'function',
      canCopy: Boolean(navigator.clipboard),
    })
  }, [])
  const { canShareNatively, canCopy } = capabilities

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(url)
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS)
  }

  return (
    <div className="adc-share" role="group" aria-label={messages.shareLabel}>
      <span className="adc-label">{messages.shareLabel}</span>
      {canShareNatively && (
        <button
          type="button"
          className="adc-button"
          onClick={() => void navigator.share({ url, title }).catch(() => undefined)}
        >
          <Share2 aria-hidden="true" className="adc-icon" />
          {messages.shareNative}
        </button>
      )}
      {links.map((link) => (
        <a
          key={link.network}
          className={`adc-button adc-share-link adc-share-link--${link.network}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={format('shareOn', { network: messages[NETWORK_LABEL[link.network]] })}
        >
          {messages[NETWORK_LABEL[link.network]]}
        </a>
      ))}
      {canCopy && (
        <button type="button" className="adc-button" onClick={() => void handleCopy().catch(() => undefined)}>
          {isCopied ? (
            <Check aria-hidden="true" className="adc-icon" />
          ) : (
            <Link2 aria-hidden="true" className="adc-icon" />
          )}
          <span aria-live="polite">{isCopied ? messages.linkCopied : messages.copyLink}</span>
        </button>
      )}
    </div>
  )
}
