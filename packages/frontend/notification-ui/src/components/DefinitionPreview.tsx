/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Pré-visualização do editor de mensagens declaradas: o e-mail aparece renderizado (documento
 * dentro de `<iframe sandbox>`, nunca como texto) e o WhatsApp dentro do aparelho, os dois com
 * seletor de tamanho e quadro que encolhe para caber.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Monitor, Smartphone, Tablet } from 'lucide-react'
import { interpolateEmailHtml, buildPreviewPayload } from '@adatechnology/notification-contracts'
import type { TemplateEditorItem } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import type { NotificationMessages } from '../locales'
import {
  EMAIL_PREVIEW_DEVICES,
  PREVIEW_DEVICE,
  PHONE_PREVIEW_WIDTH,
  looksLikeHtml,
  type PreviewDevice,
} from '../previewDevice.util'
import { renderDefinitionPreview, templateEditorItemId } from '../templateDefinitions.util'
import { PreviewDeviceSwitch, type PreviewDeviceOption } from './PreviewDeviceSwitch'
import { ScaledPreviewFrame } from './ScaledPreviewFrame'
import { TemplatePreview, type PreviewLabels } from './TemplatePreview'

const PREVIEW_DEBOUNCE_MS = 300
const WHATSAPP_DEVICES = ['ios', 'android'] as const

export type EmailPreviewRequest = {
  readonly key: string
  readonly locale: string
  readonly subject?: string
  readonly body: string
}

/** O e-mail como o produto o envia: documento completo, com as variáveis de HTML do sistema montadas. */
export type EmailPreviewResult = {
  readonly html: string
  /** Documento servido pelo produto com CSP própria (ver `TemplatePreview.emailSrc`); prevalece sobre `html`. */
  readonly url?: string
  readonly subject?: string
}

export type DefinitionPreviewProps = {
  readonly item: TemplateEditorItem
  readonly body: string
  /** Nome do remetente na moldura do e-mail e do WhatsApp. */
  readonly senderName?: string
  /** Variáveis que o sistema monta como HTML; no preview local entram sem escape, com o exemplo declarado. */
  readonly systemHtmlVariables?: readonly string[]
  /**
   * Renderiza o e-mail no produto (mesmo renderer do envio), para a prévia ser idêntica ao enviado.
   * Ausente, o pacote interpola os exemplos declarados no navegador.
   */
  loadEmailPreview?(request: EmailPreviewRequest): Promise<EmailPreviewResult>
}

function buildLabels(messages: NotificationMessages): PreviewLabels {
  return {
    to: messages['preview.to'],
    now: messages['preview.now'],
    mailbox: messages['preview.mailbox'],
    time: messages['preview.time'],
    address: messages['preview.address'],
    counter: messages['preview.counter'],
    folder: messages['preview.folder'],
    senderAddress: messages['preview.senderAddress'],
    unsubscribe: messages['preview.unsubscribe'],
    online: messages['preview.online'],
    today: messages['preview.today'],
    compose: messages['preview.compose'],
    reply: messages['preview.reply'],
    forward: messages['preview.forward'],
    replyAll: messages['preview.replyAll'],
  }
}

function useDebounced<TValue>(value: TValue, delayMs: number): TValue {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function buildLocalEmailHtml(params: {
  readonly item: TemplateEditorItem
  readonly body: string
  readonly systemHtmlVariables: readonly string[]
}): string | undefined {
  if (!looksLikeHtml(params.body)) return undefined
  const values = buildPreviewPayload(params.item.variables)
  return interpolateEmailHtml({
    template: params.body,
    values,
    systemHtml: values,
    systemHtmlNames: params.systemHtmlVariables,
  })
}

const DEVICE_ICON: Readonly<Record<PreviewDevice, ReactNode>> = {
  [PREVIEW_DEVICE.DESKTOP]: <Monitor size={16} />,
  [PREVIEW_DEVICE.TABLET]: <Tablet size={16} />,
  [PREVIEW_DEVICE.MOBILE]: <Smartphone size={16} />,
}

function EmailDefinitionPreview(props: DefinitionPreviewProps) {
  const { messages } = useNotificationContext()
  const { item, body, senderName, loadEmailPreview, systemHtmlVariables = [] } = props
  const [device, setDevice] = useState<PreviewDevice>(PREVIEW_DEVICE.DESKTOP)
  const debouncedBody = useDebounced(body, PREVIEW_DEBOUNCE_MS)
  const subject = item.current?.subject ?? item.defaultSubject

  const remote = useQuery({
    queryKey: ['adn', 'email-preview', templateEditorItemId(item), subject ?? '', debouncedBody],
    queryFn: () =>
      loadEmailPreview!({ key: item.key, locale: item.locale, body: debouncedBody, ...(subject ? { subject } : {}) }),
    enabled: loadEmailPreview !== undefined && looksLikeHtml(debouncedBody),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const rendered = renderDefinitionPreview(item, body)
  const emailHtml = loadEmailPreview ? remote.data?.html : buildLocalEmailHtml({ item, body, systemHtmlVariables })
  const title = remote.data?.subject ?? rendered.title
  const options: PreviewDeviceOption[] = EMAIL_PREVIEW_DEVICES.map((entry) => ({
    id: entry.id,
    label: messages[`definitions.device.${entry.id}`],
    icon: DEVICE_ICON[entry.id],
  }))
  const active = EMAIL_PREVIEW_DEVICES.find((entry) => entry.id === device) ?? EMAIL_PREVIEW_DEVICES[0]!

  return (
    <div className="adn-definitions__device-preview" data-device={device}>
      <PreviewDeviceSwitch
        label={messages['definitions.deviceLabel']}
        options={options}
        value={device}
        onChange={(id) => setDevice(id as PreviewDevice)}
      />
      {remote.isError ? (
        <p className="adn-definitions__state" role="alert">
          {messages['definitions.previewError']}
        </p>
      ) : null}
      <ScaledPreviewFrame width={active.width}>
        <TemplatePreview
          channel="email"
          viewport={active.viewport}
          rendered={{ ...rendered, title }}
          labels={buildLabels(messages)}
          {...(emailHtml ? { emailHtml } : {})}
          {...(remote.data?.url ? { emailSrc: remote.data.url } : {})}
          {...(senderName ? { senderName } : {})}
        />
      </ScaledPreviewFrame>
    </div>
  )
}

const PHONE_CHANNELS = ['whatsapp', 'push', 'sms'] as const

/** WhatsApp (balão na conversa), push (cartão na tela bloqueada) e SMS: o mesmo aparelho, iPhone ou Android. */
function PhoneDefinitionPreview(props: DefinitionPreviewProps) {
  const { messages } = useNotificationContext()
  const [os, setOs] = useState<string>(WHATSAPP_DEVICES[0])
  const rendered = renderDefinitionPreview(props.item, props.body)
  const options: PreviewDeviceOption[] = WHATSAPP_DEVICES.map((id) => ({
    id,
    label: messages[`settings.viewport.${id}`],
    icon: <Smartphone size={16} />,
  }))

  return (
    <div className="adn-definitions__device-preview" data-device={os} data-channel={props.item.channel}>
      <PreviewDeviceSwitch label={messages['definitions.deviceLabel']} options={options} value={os} onChange={setOs} />
      <ScaledPreviewFrame width={PHONE_PREVIEW_WIDTH}>
        <TemplatePreview
          channel={props.item.channel}
          viewport={os}
          rendered={rendered}
          labels={buildLabels(messages)}
          {...(props.senderName ? { senderName: props.senderName } : {})}
        />
      </ScaledPreviewFrame>
    </div>
  )
}

/** O aviso dentro do próprio produto (sino): um cartão só, sem aparelho para escolher. */
function InboxDefinitionPreview(props: DefinitionPreviewProps) {
  const { messages } = useNotificationContext()
  const rendered = renderDefinitionPreview(props.item, props.body)
  return (
    <div className="adn-definitions__device-preview" data-channel="inbox">
      <TemplatePreview channel="inbox" viewport="browser" rendered={rendered} labels={buildLabels(messages)} />
    </div>
  )
}

export function DefinitionPreview(props: DefinitionPreviewProps) {
  const { channel } = props.item
  if (channel === 'email') return <EmailDefinitionPreview {...props} />
  if ((PHONE_CHANNELS as readonly string[]).includes(channel)) return <PhoneDefinitionPreview {...props} />
  return <InboxDefinitionPreview {...props} />
}
