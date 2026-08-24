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
}

function Phone({ children, tone }: { children: React.ReactNode; tone?: 'dark' }) {
  return (
    <div className={tone === 'dark' ? 'adn-preview-phone adn-preview-phone--dark' : 'adn-preview-phone'}>
      {/* Sem barra de status falsa: no aparelho real ela é desenhada por cima, e a pintada fica dobrada. */}
      <div className="adn-preview-phone__screen">{children}</div>
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
      <div className="adn-preview-mail">
        <div className="adn-preview-mail__subject">{rendered.title}</div>
        <div className="adn-preview-mail__from">
          <span className="adn-preview-avatar">{senderName.slice(0, 1)}</span>
          <span className="adn-preview-mail__sender">{senderName}</span>
          <span className="adn-preview-mail__to">{labels.to}</span>
        </div>
        <div className="adn-preview-mail__body">{rendered.body}</div>
      </div>
    </div>
  )
}

/** No celular o assunto é o que decide se a pessoa abre — ele vem antes, e cortado. */
function EmailMobile({ rendered, senderName }: { rendered: RenderedTemplatePreview; senderName: string }) {
  return (
    <Phone>
      <div className="adn-preview-mail adn-preview-mail--compact">
        <div className="adn-preview-mail__from">
          <span className="adn-preview-avatar">{senderName.slice(0, 1)}</span>
          <span className="adn-preview-mail__sender">{senderName}</span>
        </div>
        <div className="adn-preview-mail__subject">{rendered.title}</div>
        <div className="adn-preview-mail__body">{rendered.body}</div>
      </div>
    </Phone>
  )
}

/** Balão recebido sobre o papel de parede da conversa — sem assunto, porque o canal não tem. */
function WhatsAppPreview({ rendered, labels }: { rendered: RenderedTemplatePreview; labels: PreviewLabels }) {
  return (
    <Phone>
      <div className="adn-preview-wa">
        <div className="adn-preview-wa__bubble">
          <div className="adn-preview-wa__text">{rendered.body}</div>
          <div className="adn-preview-wa__time">{labels.now}</div>
        </div>
      </div>
    </Phone>
  )
}

function SmsPreview({ rendered }: { rendered: RenderedTemplatePreview }) {
  return (
    <Phone>
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
}: {
  rendered: RenderedTemplatePreview
  senderName: string
  labels: PreviewLabels
}) {
  return (
    <Phone tone="dark">
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

  if (channel === 'whatsapp') return <WhatsAppPreview rendered={rendered} labels={labels} />
  if (channel === 'sms') return <SmsPreview rendered={rendered} />
  if (channel === 'push') return <PushPreview rendered={rendered} senderName={sender} labels={labels} />
  if (channel === 'inbox') return <InboxPreview rendered={rendered} />

  return viewport === 'mobile' ? (
    <EmailMobile rendered={rendered} senderName={sender} />
  ) : (
    <EmailDesktop rendered={rendered} senderName={sender} labels={labels} />
  )
}
