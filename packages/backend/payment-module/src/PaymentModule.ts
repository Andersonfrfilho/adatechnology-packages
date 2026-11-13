/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz. O host entrega banco, catálogo de planos e a lista de provedores (plugins); o
 * módulo não conhece nenhum provedor pelo nome e não lê a tabela de usuários de ninguém.
 *
 * Capacidade por ausência:
 * - provedor sem credencial → o webhook dele responde 503, o resto funciona;
 * - nenhum provedor com `cancelSubscription` → a rota de cancelar não é publicada;
 * - sem `customers` → a pessoa é achada só pelo `customerRef` do checkout.
 *
 * Catálogo inválido falha no BOOT, não na primeira compra.
 */

import {
  applyPaymentEvent,
  DEFAULT_PAST_DUE_GRACE_MS,
  PAYMENT_EVENT_TYPE,
  PaymentConfigInvalidError,
  PaymentFeatureRequiredError,
  PaymentProviderCapabilityMissingError,
  PaymentProviderNotConfiguredError,
  PaymentProviderUnknownError,
  PaymentPurchaseNotClaimableError,
  PaymentSubscriptionNotFoundError,
  planCatalogSchema,
  subscriptionGrantsAccess,
} from '@adatechnology/payment-contracts'
import type {
  ClaimPurchaseBody,
  ClockPort,
  CustomerResolverPort,
  Entitlement,
  IncomingWebhook,
  ListPaymentEventsQuery,
  ListSubscriptionsQuery,
  LoggerPort,
  PaymentEvent,
  PaymentHooks,
  PaymentMethod,
  PaymentProviderPort,
  PlanDefinition,
  Subscription,
} from '@adatechnology/payment-contracts'

import type { PaymentDatabase } from './database.types'
import { DrizzlePaymentStore } from './repositories/DrizzlePaymentStore'
import type { PaymentStore } from './repositories/PaymentStore'

export type PaymentModuleConfig = {
  /** O catálogo. Validado no boot: exatamente um plano `isFree`, códigos e ofertas sem repetir. */
  readonly plans: readonly PlanDefinition[]
  /** Empresa dona das linhas, quando o host separa por empresa. Ausente em single-tenant. */
  readonly companyId?: string
  /** Quanto o atraso de renovação ainda libera, depois do fim do período. Padrão: 7 dias. */
  readonly pastDueGraceMs?: number
  /**
   * Plano dado a quem pagou uma oferta que não está no catálogo (oferta nova criada no provedor e
   * ainda não declarada). Padrão: o primeiro plano pago. Quem pagou nunca fica sem acesso por isso.
   */
  readonly fallbackPlanCode?: string
}

export type CreatePaymentModuleParams = {
  /** O banco do host. Ignorado quando `store` é passado (teste). */
  readonly db?: PaymentDatabase
  readonly store?: PaymentStore
  readonly config: PaymentModuleConfig
  /** Os plugins. Um por provedor: `createHotmartPaymentProvider(...)`, e os próximos. */
  readonly providers: readonly PaymentProviderPort[]
  readonly customers?: CustomerResolverPort
  readonly hooks?: PaymentHooks
  readonly logger?: LoggerPort
  readonly clock?: ClockPort
}

export type PlanView = {
  readonly code: string
  readonly name: string
  readonly description: string | null
  readonly interval: PlanDefinition['interval']
  readonly price: PlanDefinition['price'] | null
  readonly features: readonly string[]
  readonly isFree: boolean
  readonly current: boolean
  /** Uma por provedor plugado e configurado, com o link já marcado para a pessoa. */
  readonly checkouts: readonly {
    readonly provider: string
    readonly url: string
    readonly paymentMethods: readonly PaymentMethod[]
  }[]
}

export type CustomerIdentity = {
  /** O id da pessoa no host (o mesmo que o checkout leva). */
  readonly customerRef: string
  /** Para preencher o checkout. NÃO amarra compra: para isso é `verifiedEmail`. */
  readonly email?: string
  /**
   * E-mail que o host CONFIRMOU (login social, link de confirmação). Amarra compra feita antes da
   * conta. Ausente, o módulo pergunta `customers.findEmailByRef`.
   */
  readonly verifiedEmail?: string
  readonly name?: string
}

export type PaymentModule = ReturnType<typeof createPaymentModule>

export function createPaymentModule(params: CreatePaymentModuleParams) {
  const { config, logger } = params
  const parsed = planCatalogSchema.safeParse(config.plans)
  if (!parsed.success) {
    throw new PaymentConfigInvalidError(parsed.error.issues.map((issue) => issue.message).join('; '))
  }
  const plans = config.plans
  const freePlan = plans.find((plan) => plan.isFree)!
  const fallbackPlan =
    plans.find((plan) => plan.code === config.fallbackPlanCode) ?? plans.find((plan) => !plan.isFree) ?? freePlan
  if (config.fallbackPlanCode && fallbackPlan.code !== config.fallbackPlanCode) {
    throw new PaymentConfigInvalidError(`fallbackPlanCode ${config.fallbackPlanCode} não está no catálogo`)
  }

  const providers = new Map<string, PaymentProviderPort>()
  for (const provider of params.providers) {
    if (providers.has(provider.name))
      throw new PaymentConfigInvalidError(`provedor plugado duas vezes: ${provider.name}`)
    providers.set(provider.name, provider)
  }
  for (const plan of plans) {
    for (const offer of plan.offers) {
      if (!providers.has(offer.provider)) {
        logger?.warn('payment: oferta de provedor que não está plugado', { plan: plan.code, provider: offer.provider })
      }
    }
  }

  const store = params.store ?? (params.db ? new DrizzlePaymentStore(params.db) : undefined)
  if (!store) throw new PaymentConfigInvalidError('informe db (ou store, em teste)')

  const companyId = config.companyId ?? null
  const tenant = config.companyId ? { companyId: config.companyId } : {}
  const pastDueGraceMs = config.pastDueGraceMs ?? DEFAULT_PAST_DUE_GRACE_MS
  const now = () => params.clock?.now() ?? new Date()

  function providerOf(name: string): PaymentProviderPort {
    const provider = providers.get(name)
    if (!provider) throw new PaymentProviderUnknownError(name)
    return provider
  }

  function planFor(event: PaymentEvent, current: Subscription | undefined): string {
    const byOffer = plans.find((plan) =>
      plan.offers.some((offer) => offer.provider === event.provider && offer.offerCode === event.offerCode),
    )
    if (byOffer) return byOffer.code
    if (current) return current.planCode
    logger?.warn('payment: oferta fora do catálogo; usando o plano padrão', {
      provider: event.provider,
      offerCode: event.offerCode,
      plan: fallbackPlan.code,
    })
    return fallbackPlan.code
  }

  async function resolveCustomerRef(event: PaymentEvent): Promise<string | null> {
    if (event.customerRef) {
      if (!params.customers) return event.customerRef
      const byRef = await params.customers.findByRef({ ref: event.customerRef, ...tenant })
      if (byRef) return byRef
    }
    if (event.customer.email && params.customers) {
      return (await params.customers.findByEmail({ email: event.customer.email, ...tenant })) ?? null
    }
    return null
  }

  const grants = (subscription: Pick<Subscription, 'status' | 'periodEndsAt'>) =>
    subscriptionGrantsAccess(subscription, { now: now(), pastDueGraceMs })

  async function subscriptionsOf(identity: CustomerIdentity): Promise<readonly Subscription[]> {
    const email =
      identity.verifiedEmail ?? (await params.customers?.findEmailByRef?.({ ref: identity.customerRef, ...tenant }))
    // Só amarra por e-mail confirmado: o `email` do checkout pode ser o que a pessoa digitou no
    // cadastro, e com ele quem cadastrasse o e-mail de outro comprador ficaria com a assinatura.
    if (email) await store!.claimByEmail({ companyId, customerRef: identity.customerRef, email })
    return store!.listByCustomer({ companyId, customerRef: identity.customerRef })
  }

  async function currentSubscription(identity: CustomerIdentity): Promise<Subscription | undefined> {
    const all = await subscriptionsOf(identity)
    // A que libera acesso ganha; sem nenhuma, a mais recente (para a tela dizer "cancelada").
    return all.find(grants) ?? all[0]
  }

  async function getEntitlement(identity: CustomerIdentity): Promise<Entitlement> {
    const subscription = await currentSubscription(identity)
    if (!subscription) {
      return {
        planCode: freePlan.code,
        planName: freePlan.name,
        status: 'none',
        hasAccess: false,
        features: freePlan.features,
        periodEndsAt: null,
        provider: null,
        paymentMethod: null,
      }
    }
    const hasAccess = grants(subscription)
    const plan = hasAccess ? (plans.find((entry) => entry.code === subscription.planCode) ?? fallbackPlan) : freePlan
    return {
      planCode: plan.code,
      planName: plan.name,
      status: subscription.status,
      hasAccess,
      features: plan.features,
      periodEndsAt: subscription.periodEndsAt,
      provider: subscription.provider,
      paymentMethod: subscription.paymentMethod,
    }
  }

  async function hasFeature(identity: CustomerIdentity, feature: string): Promise<boolean> {
    return (await getEntitlement(identity)).features.includes(feature)
  }

  return {
    config,
    plans,
    store,
    /** Algum provedor plugado sabe cancelar pela API? Sem isso a rota de cancelar não existe. */
    canCancel: params.providers.some((provider) => typeof provider.cancelSubscription === 'function'),
    useCases: {
      async receiveWebhook(input: { readonly provider: string } & IncomingWebhook) {
        const provider = providerOf(input.provider)
        if (!provider.isConfigured()) throw new PaymentProviderNotConfiguredError(provider.name)
        const event = await provider.parseWebhook({ headers: input.headers, rawBody: input.rawBody })
        const customerRef = await resolveCustomerRef(event)
        const result = await store.applyEvent({
          companyId,
          event,
          customerRef,
          decide(current) {
            if (!event.subscriptionId) return undefined
            const state = applyPaymentEvent(current, event)
            if (!state) return undefined
            return { state, planCode: planFor(event, current) }
          },
        })
        const duplicate = result.outcome === 'duplicate'
        logger?.info('payment: webhook recebido', {
          provider: event.provider,
          type: event.providerEventType,
          duplicate,
          linkedToCustomer: customerRef !== null,
        })
        if (result.outcome === 'recorded' && result.subscription && params.hooks?.onSubscriptionChanged) {
          const changed =
            result.previous?.status !== result.subscription.status ||
            result.previous?.planCode !== result.subscription.planCode
          if (changed) {
            await params.hooks.onSubscriptionChanged({
              subscription: result.subscription,
              event,
              previousStatus: result.previous?.status,
            })
          }
        }
        return { duplicate, type: event.type === PAYMENT_EVENT_TYPE.IGNORED ? 'ignored' : 'applied' } as const
      },

      getEntitlement,
      hasFeature,

      /** Para as rotas do host que exigem plano: 402 quando o plano da pessoa não libera. */
      async requireFeature(identity: CustomerIdentity, feature: string): Promise<void> {
        if (!(await hasFeature(identity, feature))) throw new PaymentFeatureRequiredError(feature)
      },

      async listPlans(identity: CustomerIdentity): Promise<readonly PlanView[]> {
        const mine = await getEntitlement(identity)
        return plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          description: plan.description ?? null,
          interval: plan.interval,
          price: plan.price ?? null,
          features: plan.features,
          isFree: plan.isFree === true,
          current: plan.code === mine.planCode,
          checkouts: plan.offers.flatMap((offer) => {
            const provider = providers.get(offer.provider)
            if (!provider || !offer.checkoutUrl) return []
            return [
              {
                provider: provider.name,
                url: provider.buildCheckoutUrl({
                  checkoutUrl: offer.checkoutUrl,
                  customerRef: identity.customerRef,
                  ...(identity.email ? { email: identity.email } : {}),
                  ...(identity.name ? { name: identity.name } : {}),
                }),
                paymentMethods: offer.paymentMethods ?? provider.paymentMethods,
              },
            ]
          }),
        }))
      },

      /**
       * Compra feita sem o id da pessoa no checkout e com e-mail que não bate: a pessoa resgata com o
       * código da transação (vem no e-mail de confirmação do provedor). O host deve limitar
       * tentativas por pessoa: o código é o único segredo aqui.
       */
      async claimPurchase(identity: CustomerIdentity, input: ClaimPurchaseBody): Promise<Entitlement> {
        const provider = providerOf(input.provider)
        const claimed = await store.claimByTransaction({
          companyId,
          customerRef: identity.customerRef,
          provider: provider.name,
          transactionId: input.transactionId,
        })
        if (!claimed) throw new PaymentPurchaseNotClaimableError()
        logger?.info('payment: compra resgatada pelo código', { provider: provider.name })
        return getEntitlement(identity)
      },

      /** Cancela pela API do provedor. O estado final chega pelo webhook; aqui só antecipa. */
      async cancelSubscription(identity: CustomerIdentity): Promise<Subscription> {
        const subscription = await currentSubscription(identity)
        if (!subscription || !grants(subscription)) throw new PaymentSubscriptionNotFoundError()
        const provider = providerOf(subscription.provider)
        if (!provider.cancelSubscription) throw new PaymentProviderCapabilityMissingError(provider.name, 'cancelamento')
        await provider.cancelSubscription({ subscriptionId: subscription.externalId })
        const at = now()
        await store.markCanceled({ id: subscription.id, at })
        return { ...subscription, status: 'canceled', canceledAt: at, updatedAt: at }
      },

      overview: () => store.overview({ companyId, now: now(), pastDueGraceMs }),
      listSubscriptions: (query: ListSubscriptionsQuery) => store.listSubscriptions({ companyId, ...query }),
      listEvents: (query: ListPaymentEventsQuery) => store.listEvents({ companyId, ...query }),
    },
  } as const
}
