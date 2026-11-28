/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo de cupons e promoções. Recebe a conexão Drizzle do host e devolve os
 * use-cases; as rotas saem de `createCouponRoutes` sobre este objeto.
 */

import {
  cryptoRandomInt,
  CouponConfigMissingError,
  type ClockPort,
  type CouponHooks,
  type CouponModuleConfig,
  type CustomerIdentityPort,
  type LeadNotifierPort,
  type LoggerPort,
  type RandomIntSource,
} from '@adatechnology/coupon-contracts'

import type { CouponDatabase } from './database.types'
import { createDrizzleCouponPersistence } from './repositories/createDrizzleCouponPersistence'
import {
  CreateCampaignUseCase,
  GetCampaignReportUseCase,
  GetCampaignUseCase,
  ListCampaignsUseCase,
  RemoveCampaignUseCase,
  UpdateCampaignUseCase,
} from './use-cases/Campaign.use-cases'
import { GenerateCodesUseCase, ListCouponsUseCase, SetCouponStatusUseCase } from './use-cases/Code.use-cases'
import type { CouponDependencies, CouponPersistence } from './use-cases/couponModule.types'
import { ExportCampaignDataUseCase } from './use-cases/Export.use-cases'
import { AnonymiseLeadUseCase, CaptureLeadUseCase, ListLeadsUseCase } from './use-cases/Lead.use-cases'
import { ListRedemptionsUseCase, RedeemCouponUseCase, ReleaseRedemptionUseCase } from './use-cases/Redemption.use-cases'
import {
  FindAutomaticUseCase,
  GetPublicCampaignUseCase,
  ListPublicCampaignsUseCase,
  QuoteCouponUseCase,
  ValidateCouponUseCase,
} from './use-cases/Validation.use-cases'

export type CouponModuleProviders = {
  /** Envia o código à pessoa (e-mail, WhatsApp). Ausente: o código só aparece na tela. */
  readonly leadNotifier?: LeadNotifierPort
  /** Liga o lead ao cliente do host. Ausente: o lead fica sem `customerRef`. */
  readonly customerIdentity?: CustomerIdentityPort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  /** Padrão: `crypto.getRandomValues`. Os testes injetam uma sequência fixa. */
  readonly randomInt?: RandomIntSource
  /** Troca a persistência (ex.: dublê em memória num teste do host). Padrão: Drizzle sobre `db`. */
  readonly persistence?: CouponPersistence
}

export type CreateCouponModuleParams = {
  readonly db?: CouponDatabase
  readonly config?: CouponModuleConfig
  readonly providers?: CouponModuleProviders
  readonly hooks?: CouponHooks
}

export type CouponModule = {
  readonly useCases: {
    readonly createCampaign: CreateCampaignUseCase
    readonly updateCampaign: UpdateCampaignUseCase
    readonly getCampaign: GetCampaignUseCase
    readonly listCampaigns: ListCampaignsUseCase
    readonly removeCampaign: RemoveCampaignUseCase
    readonly getCampaignReport: GetCampaignReportUseCase
    readonly generateCodes: GenerateCodesUseCase
    readonly listCoupons: ListCouponsUseCase
    readonly setCouponStatus: SetCouponStatusUseCase
    readonly validateCoupon: ValidateCouponUseCase
    readonly findAutomatic: FindAutomaticUseCase
    /** Desconto e total para um pedido do host, sem resgatar (ex.: tela de orçamento da reserva). */
    readonly quoteCoupon: QuoteCouponUseCase
    readonly listPublicCampaigns: ListPublicCampaignsUseCase
    readonly getPublicCampaign: GetPublicCampaignUseCase
    readonly redeemCoupon: RedeemCouponUseCase
    readonly releaseRedemption: ReleaseRedemptionUseCase
    readonly listRedemptions: ListRedemptionsUseCase
    readonly captureLead: CaptureLeadUseCase
    readonly listLeads: ListLeadsUseCase
    /** LGPD: apaga os dados pessoais do contato. */
    readonly anonymiseLead: AnonymiseLeadUseCase
    readonly exportCampaignData: ExportCampaignDataUseCase
  }
  readonly config: CouponModuleConfig
}

const SYSTEM_CLOCK: ClockPort = { now: () => new Date() }

export function createCouponModule(params: CreateCouponModuleParams): CouponModule {
  const config = params.config ?? {}
  if (config.phoneCountryCode !== undefined && !/^\d{1,3}$/.test(config.phoneCountryCode))
    throw new CouponConfigMissingError('phoneCountryCode')
  const persistence =
    params.providers?.persistence ?? (params.db ? createDrizzleCouponPersistence(params.db) : undefined)
  if (!persistence) throw new CouponConfigMissingError('db')

  const providers = params.providers ?? {}
  const dependencies: CouponDependencies = {
    persistence,
    config,
    clock: providers.clock ?? SYSTEM_CLOCK,
    randomInt: providers.randomInt ?? cryptoRandomInt,
    ...(params.hooks ? { hooks: params.hooks } : {}),
    ...(providers.leadNotifier ? { leadNotifier: providers.leadNotifier } : {}),
    ...(providers.customerIdentity ? { customerIdentity: providers.customerIdentity } : {}),
    ...(providers.logger ? { logger: providers.logger } : {}),
  }

  // Exportação é ação sensível: sem o gancho, a única trilha é o log. Avisa no boot, não em silêncio.
  if (!params.hooks?.onExported)
    dependencies.logger?.warn('coupons: hooks.onExported ausente — exportações sem trilha de auditoria do host')

  return {
    useCases: {
      createCampaign: new CreateCampaignUseCase(dependencies),
      updateCampaign: new UpdateCampaignUseCase(dependencies),
      getCampaign: new GetCampaignUseCase(dependencies),
      listCampaigns: new ListCampaignsUseCase(dependencies),
      removeCampaign: new RemoveCampaignUseCase(dependencies),
      getCampaignReport: new GetCampaignReportUseCase(dependencies),
      generateCodes: new GenerateCodesUseCase(dependencies),
      listCoupons: new ListCouponsUseCase(dependencies),
      setCouponStatus: new SetCouponStatusUseCase(dependencies),
      validateCoupon: new ValidateCouponUseCase(dependencies),
      findAutomatic: new FindAutomaticUseCase(dependencies),
      quoteCoupon: new QuoteCouponUseCase(dependencies),
      listPublicCampaigns: new ListPublicCampaignsUseCase(dependencies),
      getPublicCampaign: new GetPublicCampaignUseCase(dependencies),
      redeemCoupon: new RedeemCouponUseCase(dependencies),
      releaseRedemption: new ReleaseRedemptionUseCase(dependencies),
      listRedemptions: new ListRedemptionsUseCase(dependencies),
      captureLead: new CaptureLeadUseCase(dependencies),
      listLeads: new ListLeadsUseCase(dependencies),
      anonymiseLead: new AnonymiseLeadUseCase(dependencies),
      exportCampaignData: new ExportCampaignDataUseCase(dependencies),
    },
    config,
  }
}
