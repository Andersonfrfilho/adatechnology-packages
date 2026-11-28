/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Renderização no servidor (sem DOM) das telas e peças: o que aparece, o que some por ausência de
 * capacidade, rótulos trocados pelo host e acessibilidade básica.
 */

import { describe, expect, it } from 'bun:test'
import type { Campaign, CampaignListItem, PublicCampaign } from '@adatechnology/coupon-contracts'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { CouponsProvider, type CouponsProviderProps } from '../providers/CouponsProvider'
import type { CouponsAdminApi } from '../providers/types'
import { CampaignBanner } from './CampaignBanner'
import { CampaignDetail } from './CampaignDetail'
import { DateRangeField } from './DateRangeField'
import { ConfirmDialog } from './ConfirmDialog'
import { DateTimeField } from './DateTimeField'
import { Pagination } from './Pagination'
import { CampaignEditor } from './CampaignEditor'
import { CampaignTable } from './CampaignTable'
import { CampaignsWorkspace } from './CampaignsWorkspace'
import { CouponField } from './CouponField'
import { LeadCaptureDialog } from './LeadCaptureDialog'
import { ListToolbar } from './ListToolbar'
import { ReportPanel } from './ReportPanel'

const adminApi: CouponsAdminApi = {
  listCampaigns: async () => ({ data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 } }),
  getCampaign: async () => CAMPAIGN,
  createCampaign: async () => CAMPAIGN,
  updateCampaign: async () => CAMPAIGN,
}

const render = (node: ReactNode, props: Partial<CouponsProviderProps> = {}) =>
  renderToStaticMarkup(
    <CouponsProvider adminApi={adminApi} {...props}>
      {node}
    </CouponsProvider>,
  )

const CAMPAIGN: Campaign = {
  id: 'c1',
  companyId: 'co',
  name: 'Inauguração',
  title: 'Ganhe 10% na primeira reserva',
  text: 'Deixe seu contato.',
  terms: 'Válido uma vez por pessoa.',
  isActive: true,
  startsAt: null,
  endsAt: '2026-12-31T23:59:00.000Z',
  discount: { kind: 'percent', value: 10, maxDiscountCents: null, minSubtotalCents: null },
  codeMode: 'fixed',
  fixedCode: 'BEMVINDO',
  codePrefix: null,
  usageLimitTotal: null,
  usageLimitPerCustomer: null,
  usageLimitPerCode: null,
  scope: { kind: 'all' },
  isAutomatic: false,
  leadCapture: {
    enabled: true,
    fields: { name: 'optional', phone: 'required', email: 'off' },
    consentText: 'Aceito receber o cupom (LGPD).',
  },
  leadTag: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const PUBLIC: PublicCampaign = { ...CAMPAIGN }
const ITEM: CampaignListItem = { ...CAMPAIGN, stats: { redemptionCount: 12, discountCents: 34_500, leadCount: 40 } }

describe('lista de campanhas', () => {
  it('linha com situação, desconto, totais e seleção acessível; ordenação anunciada', () => {
    const html = render(
      <CampaignTable
        campaigns={[ITEM]}
        state={{ sort: 'name', order: 'asc' }}
        selectedIds={new Set(['c1'])}
        now={new Date('2026-11-20T00:00:00Z')}
        onToggleSort={() => undefined}
        onToggleSelected={() => undefined}
        onSelectAll={() => undefined}
        onOpen={() => undefined}
      />,
    )
    expect(html).toContain('No ar')
    expect(html).toContain('10%')
    expect(html).toContain('R$')
    expect(html).toContain('345,00')
    expect(html).toContain('aria-label="Selecionar Inauguração"')
    expect(html).toContain('aria-sort="ascending"')
    expect(html).toContain('BEMVINDO')
  })

  it('barra: total no singular e plural; "limpar filtros" só com filtro', () => {
    const toolbar = (total: number, hasFilters: boolean) =>
      render(
        <ListToolbar
          id="t"
          search=""
          searchPlaceholder="Buscar"
          onSearchChange={() => undefined}
          total={total}
          hasFilters={hasFilters}
          onClearFilters={() => undefined}
        />,
      )
    expect(toolbar(128, false)).toContain('128 resultados')
    expect(toolbar(128, false)).not.toContain('Limpar filtros')
    expect(toolbar(1, true)).toContain('1 resultado')
    expect(toolbar(1, true)).toContain('Limpar filtros')
  })

  it('workspace abre na lista, com busca, filtro de situação, exportar e nova campanha', () => {
    const html = render(<CampaignsWorkspace syncUrl={false} />)
    for (const text of ['Campanhas e cupons', 'role="search"', 'No ar', 'Agendada', 'Exportar', 'Nova campanha'])
      expect(html).toContain(text)
  })

  it('rótulos trocados pelo host (slot de labels) e locale inglês', () => {
    expect(render(<CampaignsWorkspace syncUrl={false} />, { messages: { workspaceTitle: 'Promoções' } })).toContain(
      'Promoções',
    )
    expect(render(<CampaignsWorkspace syncUrl={false} />, { locale: 'en' })).toContain('Campaigns and coupons')
  })
})

describe('editor', () => {
  it('campanha nova escolhe o modo de código; existente mostra o modo travado', () => {
    const fresh = render(<CampaignEditor />)
    expect(fresh).toContain('Como o código é entregue')
    // Nada de controle nativo: grupo de botões, lista suspensa e data/hora com máscara.
    expect(fresh).not.toContain('<select')
    expect(fresh).not.toContain('datetime-local')
    expect(fresh).toContain('role="radiogroup"')
    expect(fresh).toContain('aria-haspopup="listbox"')
    expect(fresh).toContain('placeholder="DD/MM/AAAA"')
    const existing = render(<CampaignEditor campaign={CAMPAIGN} />)
    expect(existing).toContain('Não muda depois de criada.')
    expect(existing).toContain('value="BEMVINDO"')
    expect(existing).toContain('Aceito receber o cupom (LGPD).')
  })

  it('slot de render troca o select nativo', () => {
    const html = render(<CampaignEditor />, {
      renderSelect: (props) => <div data-select={props.id}>{props.label}</div>,
    })
    expect(html).not.toContain('<select')
    expect(html).toContain('data-select="acp-campaign-discount-kind"')
  })
})

describe('site', () => {
  it('campo de cupom: desconto aplicado e todos os motivos', () => {
    const valid = render(
      <CouponField
        id="c"
        value="BEMVINDO"
        onChange={() => undefined}
        items={[]}
        check={{
          status: 'valid',
          validation: {
            valid: true,
            discountCents: 1_250,
            subtotalCents: 12_500,
            eligibleSubtotalCents: 12_500,
            reasons: [],
          },
        }}
      />,
    )
    expect(valid).toContain('Cupom aplicado')
    expect(valid).toContain('12,50')
    const invalid = render(
      <CouponField
        id="c"
        value="X"
        onChange={() => undefined}
        items={[]}
        check={{ status: 'invalid', reasons: ['expired', 'min_subtotal_not_met'] }}
      />,
    )
    expect(invalid).toContain('O cupom expirou.')
    expect(invalid).toContain('Valor mínimo não atingido.')
    expect(invalid).toContain('aria-invalid="true"')
  })

  it('campo de cupom some sem prévia disponível', () => {
    expect(render(<CouponField id="c" value="" onChange={() => undefined} items={[]} />)).toBe('')
  })

  it('diálogo pede só os campos da campanha e o aceite', () => {
    const html = render(
      <LeadCaptureDialog
        campaign={PUBLIC}
        onClose={() => undefined}
        privacyNote={<a href="/privacidade">Política</a>}
      />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('id="acp-lead-phone"')
    expect(html).toContain('id="acp-lead-name"')
    expect(html).not.toContain('id="acp-lead-email"')
    expect(html).toContain('Aceito receber o cupom (LGPD).')
    expect(html).toContain('href="/privacidade"')
  })

  it('banner: título e desconto; botão só com captação disponível', () => {
    const withoutCapture = render(<CampaignBanner campaign={PUBLIC} />)
    expect(withoutCapture).toContain('Ganhe 10% na primeira reserva')
    expect(withoutCapture).toContain('10% de desconto')
    expect(withoutCapture).not.toContain('Quero meu cupom')
    const withCapture = render(<CampaignBanner campaign={PUBLIC} />, {
      publicApi: {
        captureLead: async () => ({
          leadId: 'l',
          outcome: 'created',
          isNew: true,
          codeResent: true,
          couponCode: 'X',
          discount: CAMPAIGN.discount,
          endsAt: null,
        }),
      },
    })
    expect(withCapture).toContain('Quero meu cupom')
  })

  it('relatório em cartões', () => {
    const html = render(
      <ReportPanel
        report={{
          campaignId: 'c1',
          redemptionCount: 3,
          releasedCount: 1,
          discountCents: 4_500,
          subtotalCents: 45_000,
          leadCount: 9,
          couponCount: 10,
          usedCouponCount: 3,
        }}
      />,
    )
    expect(html).toContain('3 de 10')
    expect(html).toContain('45,00')
  })
})

describe('controles próprios', () => {
  it('data e hora mostram o fuso da empresa e o valor nos dois campos', () => {
    const html = render(
      <DateTimeField id="d" label="Termina em" value="2026-12-31T23:59" onChange={() => undefined} />,
      { timeZone: 'America/Sao_Paulo' },
    )
    expect(html).toContain('value="31/12/2026"')
    expect(html).toContain('value="23:59"')
    expect(html).toContain('Horário de America/Sao_Paulo.')
  })

  it('itens por página é lista suspensa acessível, não select nativo', () => {
    const html = render(
      <Pagination
        id="p"
        page={1}
        totalPages={3}
        pageSize={20}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
      />,
    )
    expect(html).not.toContain('<select')
    expect(html).toContain('aria-haspopup="listbox"')
    expect(html).toContain('aria-current="page"')
  })

  it('confirmação no desenho do pacote', () => {
    const html = render(
      <ConfirmDialog
        message="Excluir?"
        confirmLabel="Excluir"
        isDanger
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('Cancelar')
    expect(html).toContain('Excluir?')
  })

  it('recusa genérica do site tem texto próprio', () => {
    const html = render(
      <CouponField
        id="c"
        value="X"
        onChange={() => undefined}
        items={[]}
        check={{ status: 'invalid', reasons: ['not_applicable'] }}
      />,
    )
    expect(html).toContain('Este cupom não vale para este pedido.')
  })
})

describe('integração com host de reservas', () => {
  it('editor tem a etiqueta do cliente e a captação liga também em campanha automática', () => {
    const html = render(<CampaignEditor campaign={{ ...CAMPAIGN, isAutomatic: true, leadTag: 'inauguracao' }} />)
    expect(html).toContain('Etiqueta do cliente')
    expect(html).toContain('value="inauguracao"')
    expect(html).not.toMatch(/id="acp-campaign-leadCapture-enabled"[^>]*disabled/)
  })

  it('filtro de período padrão com máscara e fuso; slot do host substitui', () => {
    const value = { from: '2026-11-01', to: '2026-11-30' }
    const html = render(<DateRangeField id="r" label="Período" value={value} onChange={() => undefined} />, {
      timeZone: 'America/Sao_Paulo',
    })
    expect(html).toContain('value="01/11/2026"')
    expect(html).toContain('value="30/11/2026"')
    expect(html).not.toContain('type="date"')
    const injected = render(<DateRangeField id="r" label="Período" value={value} onChange={() => undefined} />, {
      renderDateRangeInput: (props) => <div data-range={props.value.from} />,
    })
    expect(injected).toContain('data-range="2026-11-01"')
  })

  it('só leitura: abre nos contatos com o filtro de período, sem configuração nem excluir', () => {
    const html = render(
      <CampaignDetail
        campaign={CAMPAIGN}
        readOnly
        onBack={() => undefined}
        onSaved={() => undefined}
        onRemoved={() => undefined}
      />,
      {
        adminApi: {
          ...adminApi,
          removeCampaign: async () => undefined,
          listLeads: async () => ({ data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 1 } }),
        },
      },
    )
    expect(html).not.toContain('Configuração')
    expect(html).not.toContain('Excluir')
    expect(html).toContain('Período')
    expect(html).toContain('aria-selected="true"')
  })

  it('workspace só leitura não oferece nova campanha', () => {
    expect(render(<CampaignsWorkspace syncUrl={false} readOnly />)).not.toContain('Nova campanha')
  })
})
