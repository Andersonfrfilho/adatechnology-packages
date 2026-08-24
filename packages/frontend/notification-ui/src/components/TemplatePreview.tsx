/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O preview com a moldura do canal, e não uma caixa branca igual para todos.
 *
 * Duas caixas idênticas rotuladas "600px" e "375px" não respondem a pergunta que alguém tem ao
 * escrever a mensagem: *como isso chega?* Um e-mail chega numa caixa de entrada, com remetente e
 * assunto acima do texto; um WhatsApp chega como balão sobre o papel de parede da conversa; um SMS
 * chega sem assunto nenhum, contado em segmentos de 160; um push chega como cartão na tela
 * bloqueada, cortado em duas linhas. O corte e o enquadramento SÃO a informação — sem eles o
 * preview só prova que o texto existe.
 *
 * Nada aqui usa `dangerouslySetInnerHTML`: o corpo entra como nó de texto, mesmo já escapado pelo
 * renderer do `notification-contracts`.
 */

import type { RenderedTemplatePreview } from '@adatechnology/notification-contracts'

export type TemplatePreviewProps = {
  readonly channel: string
  readonly viewport: string
  readonly rendered: RenderedTemplatePreview
  /** Nome do produto, para o cabeçalho do e-mail e o do push. O pacote não sabe de quem é a marca. */
  readonly senderName?: string
  /** Os textos da moldura. Nada aqui é hardcoded — nem "para você", nem "agora" (web.md §6). */
  readonly labels: PreviewLabels
}

export type PreviewLabels = {
  readonly to: string
  readonly now: string
  readonly mailbox: string
  /** Hora da barra de status do aparelho. */
  readonly time: string
}

/**
 * O aparelho. `os` muda mais que a largura: o raio da moldura, o raio dos balões e o desenho do
 * cartão de push são diferentes em cada sistema, e é por isso que os dois aparecem lado a lado.
 *
 * Sem barra de status falsa: no aparelho real ela é desenhada por cima, e a pintada fica dobrada.
 */
/** Sinal, wi-fi e bateria da barra de status. Desenhados, nunca emoji — escalam e herdam a cor. */
function StatusIcons() {
  return (
    <span className="adn-preview-status__icons">
      <svg width="15" height="10" viewBox="0 0 15 10" aria-hidden="true">
        <rect x="0" y="6" width="2.5" height="4" rx="0.6" fill="currentColor" />
        <rect x="4" y="4" width="2.5" height="6" rx="0.6" fill="currentColor" />
        <rect x="8" y="2" width="2.5" height="8" rx="0.6" fill="currentColor" />
        <rect x="12" y="0" width="2.5" height="10" rx="0.6" fill="currentColor" />
      </svg>
      <svg width="13" height="10" viewBox="0 0 13 10" aria-hidden="true">
        <path d="M6.5 9.2 1 3.6a7.8 7.8 0 0 1 11 0Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="6.5" cy="8" r="1" fill="currentColor" />
      </svg>
      <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
        <rect x="0.5" y="0.5" width="16" height="9" rx="2.5" fill="none" stroke="currentColor" opacity="0.5" />
        <rect x="2" y="2" width="11" height="6" rx="1.2" fill="currentColor" />
        <rect x="18" y="3.5" width="1.6" height="3" rx="0.8" fill="currentColor" opacity="0.5" />
      </svg>
    </span>
  )
}

/**
 * O aparelho inteiro: moldura, barra de status, recorte da câmera e a barra de gesto embaixo.
 *
 * `os` muda mais que a largura — no iOS o recorte é a ilha central e os cantos são bem
 * arredondados; no Android é o furo à esquerda e a moldura é mais reta. É o que faz reconhecer o
 * aparelho de relance, e é onde a mesma mensagem quebra em pontos diferentes.
 */
function Phone({
  children,
  os,
  tone,
  time,
}: {
  children: React.ReactNode
  os: string
  tone?: 'dark'
  time: string
}) {
  const android = os === 'android'
  const classes = ['adn-preview-phone', `adn-preview-phone--${android ? 'android' : 'ios'}`]
  if (tone === 'dark') classes.push('adn-preview-phone--dark')

  return (
    <div className={classes.join(' ')}>
      <div className="adn-preview-phone__screen">
        <div className="adn-preview-status">
          <span className="adn-preview-status__time">{time}</span>
          {android ? <span className="adn-preview-phone__punch" /> : <span className="adn-preview-phone__island" />}
          <StatusIcons />
        </div>
        <div className="adn-preview-phone__content">{children}</div>
        <div className="adn-preview-phone__gesture" />
      </div>
    </div>
  )
}

/** Caixa de entrada num navegador: é onde o e-mail é lido no computador. */
function EmailDesktop({
  rendered,
  senderName,
  labels,
}: {
  rendered: RenderedTemplatePreview
  senderName: string
  labels: PreviewLabels
}) {
  return (
    <div className="adn-preview-browser">
      <div className="adn-preview-browser__bar">
        <span className="adn-preview-browser__dot" />
        <span className="adn-preview-browser__dot" />
        <span className="adn-preview-browser__dot" />
        <div className="adn-preview-browser__address">{labels.mailbox}</div>
      </div>
      {/* Cabeçalho de cliente de e-mail: busca e conta. É a convenção que todos compartilham —
          nenhuma marca de terceiro é reproduzida aqui. */}
      <div className="adn-preview-mailapp">
        <div className="adn-preview-mailapp__bar">
          <span className="adn-preview-mailapp__menu" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div className="adn-preview-mailapp__search">{labels.mailbox}</div>
          <span className="adn-preview-avatar adn-preview-avatar--small">{senderName.slice(0, 1)}</span>
        </div>
        <div className="adn-preview-mail">
          <div className="adn-preview-mail__subject">{rendered.title}</div>
          <div className="adn-preview-mail__from">
            <span className="adn-preview-avatar">{senderName.slice(0, 1)}</span>
            <span className="adn-preview-mail__sender">{senderName}</span>
            <span className="adn-preview-mail__to">{labels.to}</span>
            <span className="adn-preview-mail__time">{labels.now}</span>
          </div>
          <div className="adn-preview-mail__body">{rendered.body}</div>
        </div>
      </div>
    </div>
  )
}

/** No celular o assunto é o que decide se a pessoa abre — ele vem antes, e cortado. */
function EmailMobile({
  rendered,
  senderName,
  os,
  labels,
}: {
  rendered: RenderedTemplatePreview
  senderName: string
  os: string
  labels: PreviewLabels
}) {
  return (
    <Phone os={os} time={labels.time}>
      <div className="adn-preview-mailapp__actions">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span className="adn-preview-mailapp__spacer" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 4h16v16H4zM4 8h16" />
        </svg>
      </div>
      <div className="adn-preview-mail adn-preview-mail--compact">
        <div className="adn-preview-mail__subject">{rendered.title}</div>
        <div className="adn-preview-mail__from">
          <span className="adn-preview-avatar">{senderName.slice(0, 1)}</span>
          <span className="adn-preview-mail__sender">{senderName}</span>
          <span className="adn-preview-mail__time">{labels.now}</span>
        </div>
        <div className="adn-preview-mail__body">{rendered.body}</div>
      </div>
    </Phone>
  )
}

/** Balão recebido sobre o papel de parede da conversa — sem assunto, porque o canal não tem. */
function WhatsAppPreview({
  rendered,
  labels,
  os,
}: {
  rendered: RenderedTemplatePreview
  labels: PreviewLabels
  os: string
}) {
  return (
    <Phone os={os} time={labels.time}>
      <div className="adn-preview-wa">
        <div className="adn-preview-wa__bubble">
          <div className="adn-preview-wa__text">{rendered.body}</div>
          <div className="adn-preview-wa__time">{labels.now}</div>
        </div>
      </div>
    </Phone>
  )
}

function SmsPreview({
  rendered,
  os,
  labels,
}: {
  rendered: RenderedTemplatePreview
  os: string
  labels: PreviewLabels
}) {
  return (
    <Phone os={os} time={labels.time}>
      <div className="adn-preview-sms">
        <div className="adn-preview-sms__bubble">{rendered.body}</div>
      </div>
    </Phone>
  )
}

/** Tela bloqueada: título e corpo cortados, que é onde o limite do canal aparece de verdade. */
function PushPreview({
  rendered,
  senderName,
  labels,
  os,
}: {
  rendered: RenderedTemplatePreview
  senderName: string
  labels: PreviewLabels
  os: string
}) {
  return (
    <Phone os={os} tone="dark" time={labels.time}>
      <div className="adn-preview-push">
        <div className="adn-preview-push__card">
          <div className="adn-preview-push__app">
            <span className="adn-preview-avatar adn-preview-avatar--small">{senderName.slice(0, 1)}</span>
            <span>{senderName}</span>
            <span className="adn-preview-push__time">{labels.now}</span>
          </div>
          <div className="adn-preview-push__title">{rendered.title}</div>
          <div className="adn-preview-push__body">{rendered.body}</div>
        </div>
      </div>
    </Phone>
  )
}

/** O aviso dentro do próprio produto — o cartão da lista de notificações. */
function InboxPreview({ rendered }: { rendered: RenderedTemplatePreview }) {
  return (
    <div className="adn-preview-inbox">
      <span className="adn-preview-inbox__dot" />
      <div className="adn-preview-inbox__text">
        <div className="adn-preview-inbox__title">{rendered.title}</div>
        <div className="adn-preview-inbox__body">{rendered.body}</div>
      </div>
    </div>
  )
}

export function TemplatePreview({ channel, viewport, rendered, senderName, labels }: TemplatePreviewProps) {
  /** Sem nome do produto, o remetente vira a inicial do assunto — nunca um literal inventado. */
  const sender = senderName ?? rendered.title.slice(0, 1).toUpperCase()

  if (channel === 'whatsapp') return <WhatsAppPreview rendered={rendered} labels={labels} os={viewport} />
  if (channel === 'sms') return <SmsPreview rendered={rendered} os={viewport} labels={labels} />
  if (channel === 'push') {
    return <PushPreview rendered={rendered} senderName={sender} labels={labels} os={viewport} />
  }
  if (channel === 'inbox') return <InboxPreview rendered={rendered} />

  return viewport === 'browser' ? (
    <EmailDesktop rendered={rendered} senderName={sender} labels={labels} />
  ) : (
    <EmailMobile rendered={rendered} senderName={sender} os={viewport} labels={labels} />
  )
}
