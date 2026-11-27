import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TemplateEditorItem } from '@adatechnology/notification-contracts'

import { NotificationProvider } from '../NotificationProvider'
import { fitZoom, nextOptionId } from '../previewDevice.util'
import { templateEditorItemId } from '../templateDefinitions.util'
import { DefinitionPreview } from './DefinitionPreview'

const EMAIL_ITEM = {
  key: 'booking.confirmed',
  channel: 'email',
  locale: 'pt-BR',
  label: 'Reserva confirmada',
  variables: [
    { name: 'guestName', example: 'Maria', required: false },
    { name: 'logoHtml', example: '<b data-logo>LOGO</b>', required: false },
  ],
  defaultBody: '<p>Olá {{guestName}}</p>{{logoHtml}}',
  defaultSubject: 'Reserva de {{guestName}}',
  isCustomized: false,
} as unknown as TemplateEditorItem

const WHATSAPP_ITEM = { ...EMAIL_ITEM, channel: 'whatsapp', defaultBody: 'Olá *{{guestName}}*' } as TemplateEditorItem

function render(params: { item: TemplateEditorItem; body: string; client?: QueryClient; systemHtmlVariables?: string[] }): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={params.client ?? new QueryClient()}>
      <NotificationProvider client={{} as never}>
        <DefinitionPreview
          item={params.item}
          body={params.body}
          {...(params.systemHtmlVariables ? { systemHtmlVariables: params.systemHtmlVariables } : {})}
          {...(params.client ? { loadEmailPreview: async () => ({ html: '' }) } : {})}
        />
      </NotificationProvider>
    </QueryClientProvider>,
  )
}

function srcDocOf(markup: string): string {
  const raw = /srcDoc="([^"]*)"/.exec(markup)?.[1] ?? ''
  return raw.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
}

describe('pré-visualização de e-mail do editor', () => {
  it('desenha o e-mail dentro de um iframe sandbox, nunca o HTML como texto', () => {
    const markup = render({ item: EMAIL_ITEM, body: EMAIL_ITEM.defaultBody })

    expect(markup).toContain('<iframe')
    expect(markup).toContain('sandbox=""')
    expect(srcDocOf(markup)).toContain('<p>Olá Maria</p>')
  })

  it('escapa os valores e deixa passar só o HTML das variáveis do sistema', () => {
    const markup = render({ item: EMAIL_ITEM, body: EMAIL_ITEM.defaultBody, systemHtmlVariables: ['logoHtml'] })

    expect(srcDocOf(markup)).toContain('<b data-logo>LOGO</b>')
    const without = srcDocOf(render({ item: EMAIL_ITEM, body: EMAIL_ITEM.defaultBody }))
    expect(without).not.toContain('<b data-logo>')
  })

  it('usa o HTML que o produto renderizou quando há loadEmailPreview', () => {
    const client = new QueryClient()
    client.setQueryData(
      ['adn', 'email-preview', templateEditorItemId(EMAIL_ITEM), EMAIL_ITEM.defaultSubject, EMAIL_ITEM.defaultBody],
      { html: '<p>Do servidor da empresa</p>', subject: 'Assunto do servidor' },
    )
    const markup = render({ item: EMAIL_ITEM, body: EMAIL_ITEM.defaultBody, client })

    expect(markup).toContain('Do servidor da empresa')
    expect(markup).toContain('Assunto do servidor')
  })

  it('com url do produto o iframe carrega o endereço (CSP própria) e não usa srcDoc', () => {
    const client = new QueryClient()
    client.setQueryData(
      ['adn', 'email-preview', templateEditorItemId(EMAIL_ITEM), EMAIL_ITEM.defaultSubject, EMAIL_ITEM.defaultBody],
      { html: '<p>x</p>', url: '/v1/mail-assets/template-preview/abc' },
    )
    const markup = render({ item: EMAIL_ITEM, body: EMAIL_ITEM.defaultBody, client })

    expect(markup).toContain('src="/v1/mail-assets/template-preview/abc"')
    expect(markup).toContain('sandbox=""')
    expect(markup).not.toContain('srcDoc')
  })

  it('oferece Computador, Tablet e Celular como radiogroup acessível', () => {
    const markup = render({ item: EMAIL_ITEM, body: EMAIL_ITEM.defaultBody })

    expect(markup).toContain('role="radiogroup"')
    expect(markup.match(/role="radio"/g)).toHaveLength(3)
    for (const label of ['Computador', 'Tablet', 'Celular']) expect(markup).toContain(label)
    expect(markup).toContain('aria-checked="true" tabindex="0"')
    expect(markup).toContain('tabindex="-1"')
  })

  it('o WhatsApp aparece no aparelho, com iPhone e Android', () => {
    const markup = render({ item: WHATSAPP_ITEM, body: WHATSAPP_ITEM.defaultBody })

    expect(markup).toContain('adn-preview-phone')
    expect(markup).toContain('iPhone')
    expect(markup).toContain('Android')
  })
})

describe('seletor de aparelho', () => {
  const IDS = ['desktop', 'tablet', 'mobile']

  it('as setas andam e dão a volta; Home e End vão às pontas', () => {
    expect(nextOptionId(IDS, 'desktop', 'ArrowRight')).toBe('tablet')
    expect(nextOptionId(IDS, 'mobile', 'ArrowRight')).toBe('desktop')
    expect(nextOptionId(IDS, 'desktop', 'ArrowLeft')).toBe('mobile')
    expect(nextOptionId(IDS, 'tablet', 'Home')).toBe('desktop')
    expect(nextOptionId(IDS, 'tablet', 'End')).toBe('mobile')
    expect(nextOptionId(IDS, 'tablet', 'a')).toBeUndefined()
  })

  it('o quadro só encolhe, nunca cresce', () => {
    expect(fitZoom(480, 960)).toBe(0.5)
    expect(fitZoom(1200, 960)).toBe(1)
    expect(fitZoom(0, 960)).toBe(1)
  })
})
