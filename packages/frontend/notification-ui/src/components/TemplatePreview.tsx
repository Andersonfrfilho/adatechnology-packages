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
  readonly address: string
  readonly counter: string
  readonly folder: string
  readonly senderAddress: string
  readonly unsubscribe: string
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
      {/* Botoes laterais: e o que faz a silhueta parecer um aparelho e nao um retangulo. */}
      <span className="adn-preview-phone__btn adn-preview-phone__btn--mute" />
      <span className="adn-preview-phone__btn adn-preview-phone__btn--up" />
      <span className="adn-preview-phone__btn adn-preview-phone__btn--down" />
      <span className="adn-preview-phone__btn adn-preview-phone__btn--power" />
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

/** Ícone traçado de 20px, no mesmo estilo do resto — nunca emoji (web.md §9). */
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const ICON = {
  back: 'M19 12H5M12 19l-7-7 7-7',
  archive: 'M3 8h18v12H3zM3 4h18v4H3M10 12h4',
  report: 'M12 8v5M12 16.5v.01M12 3 2 20h20Z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  unread: 'M3 5h18v14H3zM3 5l9 7 9-7',
  move: 'M3 7h6l2 2h10v10H3zM3 7V5h6l2 2',
  more: 'M12 6v.01M12 12v.01M12 18v.01',
  prev: 'M15 19l-7-7 7-7',
  next: 'M9 5l7 7-7 7',
  print: 'M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z',
  popout: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  star: 'm12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9Z',
  reply: 'M9 17H4V7M4 7l7 7M20 17v-3a6 6 0 0 0-6-6H4',
  pencil: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z',
  inbox: 'M3 12h5l2 3h4l2-3h5M3 12l2-7h14l2 7v7H3z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5',
  help: 'M12 17v.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L6.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1',
} as const

/**
 * A mensagem aberta num leitor de e-mail no computador.
 *
 * A anatomia é a que todo cliente compartilha — trilho de ações à esquerda, barra de ferramentas
 * da mensagem, contador de posição, assunto grande com o rótulo da pasta, e a linha do remetente
 * com endereço, horário e ações. Nenhuma marca de terceiro é reproduzida: sem logotipo, sem
 * wordmark, sem a paleta de nenhum produto.
 */
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
        <div className="adn-preview-browser__address">{labels.address}</div>
      </div>

      <div className="adn-preview-mailapp">
        <div className="adn-preview-mailapp__bar">
          <span className="adn-preview-mailapp__menu" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <div className="adn-preview-mailapp__search">
            <Icon d={ICON.search} size={15} />
            <span>{labels.mailbox}</span>
          </div>
          <span className="adn-preview-mailapp__account">
            <Icon d={ICON.help} size={15} />
            <Icon d={ICON.settings} size={15} />
            <span className="adn-preview-avatar adn-preview-avatar--small">{senderName.slice(0, 1)}</span>
          </span>
        </div>

        <div className="adn-preview-mailapp__split">
          <nav className="adn-preview-mailapp__rail" aria-hidden="true">
            <span className="adn-preview-mailapp__compose">
              <Icon d={ICON.pencil} size={16} />
            </span>
            <span className="adn-preview-mailapp__rail-item adn-preview-mailapp__rail-item--active">
              <Icon d={ICON.inbox} size={16} />
            </span>
            <span className="adn-preview-mailapp__rail-item">
              <Icon d={ICON.star} size={16} />
            </span>
          </nav>

          <div className="adn-preview-browser__viewport">
            <div className="adn-preview-mailapp__toolbar">
              <Icon d={ICON.back} />
              <span className="adn-preview-mailapp__divider" />
              <Icon d={ICON.archive} />
              <Icon d={ICON.report} />
              <Icon d={ICON.trash} />
              <span className="adn-preview-mailapp__divider" />
              <Icon d={ICON.unread} />
              <Icon d={ICON.move} />
              <Icon d={ICON.more} />
              <span className="adn-preview-mailapp__spacer" />
              <span className="adn-preview-mailapp__counter">{labels.counter}</span>
              <Icon d={ICON.prev} size={14} />
              <Icon d={ICON.next} size={14} />
            </div>

            <div className="adn-preview-mail">
              <div className="adn-preview-mail__subject-row">
                <div className="adn-preview-mail__subject">{rendered.title}</div>
                <span className="adn-preview-mail__folder">{labels.folder}</span>
                <span className="adn-preview-mail__subject-actions">
                  <Icon d={ICON.print} size={15} />
                  <Icon d={ICON.popout} size={15} />
                </span>
              </div>

              <div className="adn-preview-mail__from">
                <span className="adn-preview-avatar">{senderName.slice(0, 1)}</span>
                <span className="adn-preview-mail__identity">
                  <span className="adn-preview-mail__sender-row">
                    <span className="adn-preview-mail__sender">{senderName}</span>
                    <span className="adn-preview-mail__address">{labels.senderAddress}</span>
                    <span className="adn-preview-mail__unsubscribe">{labels.unsubscribe}</span>
                  </span>
                  <span className="adn-preview-mail__to">{labels.to}</span>
                </span>
                <span className="adn-preview-mail__from-actions">
                  <span className="adn-preview-mail__time">{labels.now}</span>
                  <Icon d={ICON.star} size={15} />
                  <Icon d={ICON.reply} size={15} />
                  <Icon d={ICON.more} size={15} />
                </span>
              </div>

              <div className="adn-preview-mail__body">{rendered.body}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A mesma mensagem no app de e-mail do aparelho: barra de ações fixa, mensagem rolando por baixo. */
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
        <Icon d={ICON.back} />
        <span className="adn-preview-mailapp__spacer" />
        <Icon d={ICON.archive} />
        <Icon d={ICON.trash} />
        <Icon d={ICON.unread} />
        <Icon d={ICON.more} />
      </div>
      <div className="adn-preview-mailapp__scroll">
        <div className="adn-preview-mail adn-preview-mail--compact">
          <div className="adn-preview-mail__subject">{rendered.title}</div>
          <span className="adn-preview-mail__folder">{labels.folder}</span>
          <div className="adn-preview-mail__from">
            <span className="adn-preview-avatar">{senderName.slice(0, 1)}</span>
            <span className="adn-preview-mail__identity">
              <span className="adn-preview-mail__sender">{senderName}</span>
              <span className="adn-preview-mail__to">{labels.to}</span>
            </span>
            <span className="adn-preview-mail__time">{labels.now}</span>
          </div>
          <div className="adn-preview-mail__body">{rendered.body}</div>
        </div>
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
