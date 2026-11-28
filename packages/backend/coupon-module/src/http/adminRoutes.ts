/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CampaignNotFoundError,
  CouponCodeNotFoundError,
  LeadNotFoundError,
  COUPON_STATUSES,
  createCampaignSchema,
  DEFAULT_ADMIN_SCOPES,
  exportFormatSchema,
  generateCodesSchema,
  listCampaignsQuerySchema,
  listCouponsQuerySchema,
  listLeadsQuerySchema,
  listRedemptionsQuerySchema,
  updateCampaignSchema,
  type CouponStatus,
  type CreateCampaignData,
  type ExportFormat,
  type ListCampaignsQuery,
  type ListCouponsQuery,
  type ListLeadsQuery,
  type ListRedemptionsQuery,
  type UpdateCampaignData,
} from '@adatechnology/coupon-contracts'
import type { HttpResult, ModuleRoute, RequestContext } from '@adatechnology/module-http'
import { z } from 'zod'

import type { CouponModule } from '../CouponModule'
import type { ExportFilters, ExportResult } from '../use-cases/Export.use-cases'
import { json, requireCompany, uuidParam } from './requireCompany'

const setCouponStatusSchema = z.object({ status: z.enum(COUPON_STATUSES as [CouponStatus, ...CouponStatus[]]) })

const exportLeadsQuerySchema = listLeadsQuerySchema.omit({ page: true, pageSize: true }).merge(exportFormatSchema)
const exportRedemptionsQuerySchema = listRedemptionsQuerySchema
  .omit({ page: true, pageSize: true })
  .merge(exportFormatSchema)
const exportCouponsQuerySchema = listCouponsQuerySchema.omit({ page: true, pageSize: true }).merge(exportFormatSchema)

const campaignNotFound = (value: string) => new CampaignNotFoundError(value)

function reference(context: RequestContext): { companyId: string; id: string } {
  return { companyId: requireCompany(context), id: uuidParam(context, 'id', campaignNotFound) }
}

function inCampaign(context: RequestContext): { companyId: string; campaignId: string } {
  return { companyId: requireCompany(context), campaignId: uuidParam(context, 'id', campaignNotFound) }
}

/** O arquivo vai como bytes com nome de download; o total cortado pelo teto sai num cabeçalho. */
function fileResult(result: ExportResult): HttpResult {
  return {
    kind: 'binary',
    status: 200,
    body: typeof result.body === 'string' ? new TextEncoder().encode(result.body) : result.body,
    contentType: result.contentType,
    headers: {
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'no-store',
      'X-Export-Rows': String(result.rowCount),
      'X-Export-Truncated': String(result.isTruncated),
    },
  }
}

function splitFormat<TQuery extends { format: ExportFormat }>(
  query: TQuery,
): { format: ExportFormat; rest: Omit<TQuery, 'format'> } {
  const { format, ...rest } = query
  return { format, rest }
}

export function buildAdminRoutes(module: CouponModule): ModuleRoute[] {
  const { useCases } = module
  const adminScopes = module.config.adminScopes ?? DEFAULT_ADMIN_SCOPES
  const admin = { scope: 'admin' as const, requiredScopes: adminScopes }
  // Leitura de contatos (ex.: recepção): listar campanhas, ver uma e listar os contatos dela. Exportar,
  // editar e apagar continuam só com `adminScopes`.
  const leadReader = {
    scope: 'admin' as const,
    requiredScopes: [...adminScopes, ...(module.config.leadReadScopes ?? [])],
  }

  const exportRoute = (
    kind: ExportFilters['kind'],
    querySchema: z.ZodTypeAny,
    operationId: string,
    summary: string,
  ): ModuleRoute => ({
    ...admin,
    method: 'GET',
    path: `/campaigns/:id/${kind === 'coupons' ? 'codes' : kind}/export`,
    querySchema,
    operationId,
    summary,
    async handler(context) {
      const { format, rest } = splitFormat(context.query as unknown as { format: ExportFormat })
      const result = await useCases.exportCampaignData.execute({
        ...inCampaign(context),
        userId: context.auth?.userId,
        format,
        filters: { kind, query: rest } as ExportFilters,
      })
      return fileResult(result)
    },
  })

  return [
    {
      ...leadReader,
      method: 'GET',
      path: '/campaigns',
      querySchema: listCampaignsQuerySchema,
      operationId: 'listCampaigns',
      summary: 'Campanhas da empresa, com busca, filtro por situação, ordenação, paginação e totais de uso',
      async handler(context) {
        const result = await useCases.listCampaigns.execute({
          ...(context.query as unknown as ListCampaignsQuery),
          companyId: requireCompany(context),
        })
        return { kind: 'json', status: 200, body: result }
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/campaigns',
      bodySchema: createCampaignSchema,
      operationId: 'createCampaign',
      summary: 'Cria campanha; no modo fixo, sem código informado, gera um',
      async handler(context) {
        return json(
          201,
          await useCases.createCampaign.execute({
            companyId: requireCompany(context),
            input: context.body as CreateCampaignData,
          }),
        )
      },
    },
    {
      ...leadReader,
      method: 'GET',
      path: '/campaigns/:id',
      operationId: 'getCampaign',
      summary: 'Lê uma campanha da empresa',
      async handler(context) {
        return json(200, await useCases.getCampaign.execute(reference(context)))
      },
    },
    {
      ...admin,
      method: 'PATCH',
      path: '/campaigns/:id',
      bodySchema: updateCampaignSchema,
      operationId: 'updateCampaign',
      summary: 'Atualiza campos; o modo de código não muda depois de criada',
      async handler(context) {
        return json(
          200,
          await useCases.updateCampaign.execute({ ...reference(context), input: context.body as UpdateCampaignData }),
        )
      },
    },
    {
      ...admin,
      method: 'DELETE',
      path: '/campaigns/:id',
      operationId: 'removeCampaign',
      summary: 'Apaga campanha sem uso nem contato; com histórico responde 409 (desative)',
      async handler(context) {
        await useCases.removeCampaign.execute(reference(context))
        return { kind: 'empty', status: 204 }
      },
    },
    {
      ...admin,
      method: 'GET',
      path: '/campaigns/:id/report',
      operationId: 'getCampaignReport',
      summary: 'Usos, liberações, desconto total, leads e códigos da campanha',
      async handler(context) {
        return json(200, await useCases.getCampaignReport.execute(reference(context)))
      },
    },
    {
      ...admin,
      method: 'POST',
      path: '/campaigns/:id/codes',
      bodySchema: generateCodesSchema,
      operationId: 'generateCouponCodes',
      summary: 'Gera um lote de códigos únicos (campanha em modo lote)',
      async handler(context) {
        const body = context.body as { count: number; prefix?: string }
        return json(
          201,
          await useCases.generateCodes.execute({ ...reference(context), count: body.count, prefix: body.prefix }),
        )
      },
    },
    {
      ...admin,
      method: 'GET',
      path: '/campaigns/:id/codes',
      querySchema: listCouponsQuerySchema,
      operationId: 'listCouponCodes',
      summary: 'Códigos da campanha, com usos e a quem foram entregues',
      async handler(context) {
        const result = await useCases.listCoupons.execute({
          ...(context.query as unknown as ListCouponsQuery),
          ...inCampaign(context),
        })
        return { kind: 'json', status: 200, body: result }
      },
    },
    exportRoute(
      'coupons',
      exportCouponsQuerySchema,
      'exportCouponCodes',
      'Exporta os códigos do filtro atual (CSV ou XLSX)',
    ),
    {
      ...admin,
      method: 'PATCH',
      path: '/campaigns/:id/codes/:codeId',
      bodySchema: setCouponStatusSchema,
      operationId: 'setCouponCodeStatus',
      summary: 'Ativa ou desativa um código (ex.: vazou), sem mexer na campanha',
      async handler(context) {
        const { status } = context.body as { status: CouponStatus }
        return json(
          200,
          await useCases.setCouponStatus.execute({
            status,
            campaignId: inCampaign(context).campaignId,
            id: uuidParam(context, 'codeId', (value) => new CouponCodeNotFoundError(value)),
            companyId: requireCompany(context),
          }),
        )
      },
    },
    {
      ...leadReader,
      method: 'GET',
      path: '/campaigns/:id/leads',
      querySchema: listLeadsQuerySchema,
      operationId: 'listCampaignLeads',
      summary: 'Contatos captados pela campanha; busca por nome, e-mail ou dígitos do telefone',
      async handler(context) {
        const result = await useCases.listLeads.execute({
          ...(context.query as unknown as ListLeadsQuery),
          ...inCampaign(context),
        })
        return { kind: 'json', status: 200, body: result }
      },
    },
    {
      ...admin,
      method: 'DELETE',
      path: '/campaigns/:id/leads/:leadId',
      operationId: 'anonymiseCampaignLead',
      summary: 'LGPD: apaga nome, telefone, e-mail, cliente e código do contato (a linha fica anônima para os totais)',
      async handler(context) {
        await useCases.anonymiseLead.execute({
          ...inCampaign(context),
          leadId: uuidParam(context, 'leadId', (value) => new LeadNotFoundError(value)),
        })
        return { kind: 'empty', status: 204 }
      },
    },
    exportRoute(
      'leads',
      exportLeadsQuerySchema,
      'exportCampaignLeads',
      'Exporta os contatos do filtro atual (CSV ou XLSX)',
    ),
    {
      ...admin,
      method: 'GET',
      path: '/campaigns/:id/redemptions',
      querySchema: listRedemptionsQuerySchema,
      operationId: 'listCampaignRedemptions',
      summary: 'Usos da campanha (resgatados e liberados)',
      async handler(context) {
        const result = await useCases.listRedemptions.execute({
          ...(context.query as unknown as ListRedemptionsQuery),
          ...inCampaign(context),
        })
        return { kind: 'json', status: 200, body: result }
      },
    },
    exportRoute(
      'redemptions',
      exportRedemptionsQuerySchema,
      'exportCampaignRedemptions',
      'Exporta os usos do filtro atual (CSV ou XLSX)',
    ),
  ]
}
