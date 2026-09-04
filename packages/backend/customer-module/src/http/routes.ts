/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tabela de rotas do módulo. Ela declara autorização; o despachante do host é quem aplica.
 *
 * Duas decisões que valem por escrito:
 *
 * - **`companyId` SEMPRE do `auth`**, nunca do corpo ou da query (`database.md`, multiempresa).
 *   Aceitar do cliente seria deixar escolher de qual empresa ler.
 * - **Ler e escrever têm escopos diferentes.** `customers:read` serve a atendimento; mexer na
 *   configuração é `customers:admin`, porque ali se muda máscara de PII e obrigatoriedade de campo.
 */

import { z } from 'zod'

import {
  createCustomerSchema,
  listCustomersSchema,
  updateSettingsSchema,
  customerAddressInputSchema,
} from '@adatechnology/customer-contracts'
import { ROUTE_SCOPE, type ModuleRoute, type ModuleRouteTable, type RequestContext } from '@adatechnology/module-http'

import type { CustomerModule } from '../CustomerModule'
import { toCustomer } from '../use-cases/Customer.use-case'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { CustomerNotFoundError } from '@adatechnology/customer-contracts'

export const CUSTOMER_SCOPE = {
  READ: 'customers:read',
  WRITE: 'customers:write',
  ADMIN: 'customers:admin',
} as const

const updateCustomerSchema = createCustomerSchema
  .pick({ name: true, email: true, birthDate: true })
  .extend({ attributes: z.record(z.unknown()).optional() })
  .partial()

const setDocumentSchema = z.object({ name: z.string().min(1), value: z.string().min(1) })

export type CreateCustomerRoutesParams = {
  readonly module: CustomerModule
  /**
   * Rotas de escrita publicadas. Produto que só LÊ o cadastro (o site da loja, que consulta o
   * próprio cliente) não deve expor criação — capacidade por ausência, não por flag no corpo.
   */
  readonly features?: { readonly write?: boolean; readonly settings?: boolean }
}

export function createCustomerRoutes(params: CreateCustomerRoutesParams): ModuleRouteTable {
  const { module } = params
  const { useCases, repositories, config } = module
  const write = params.features?.write ?? true
  const settings = params.features?.settings ?? true

  /** O escopo do tenant vem daqui e de nenhum outro lugar. */
  function scopeOf(context: RequestContext): string | undefined {
    return resolveScopeCompanyId({ tenancy: config.tenancy, explicit: context.auth?.companyId })
  }

  async function currentSettings(context: RequestContext) {
    const companyId = scopeOf(context)
    return useCases.getSettings.execute(companyId ? { companyId } : {})
  }

  const readRoutes: ModuleRoute[] = [
    {
      method: 'GET',
      path: '/customers',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.READ],
      querySchema: listCustomersSchema,
      operationId: 'listCustomers',
      summary: 'Lista clientes com busca por nome ou telefone',
      async handler(context) {
        const query = context.query as unknown as z.infer<typeof listCustomersSchema>
        const current = await currentSettings(context)

        const { rows, total } = await repositories.customers.list({
          companyId: scopeOf(context),
          page: query.page,
          perPage: query.perPage,
          ...(query.search ? { search: query.search } : {}),
        })

        return {
          kind: 'json',
          status: 200,
          body: {
            // A LISTAGEM não decifra documento: são N clientes, e decifrar N vezes para exibir uma
            // coluna que quase ninguém lê é chamada de rede por linha.
            data: rows.map((row) => ({
              id: row.id,
              name: row.name,
              email: row.email,
              createdAt: row.createdAt,
            })),
            pagination: { total, page: query.page, perPage: query.perPage },
            maskPhoneInList: current.maskPhoneInList,
          },
        }
      },
    },
    {
      method: 'GET',
      path: '/customers/:id',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.READ],
      operationId: 'getCustomer',
      summary: 'Ficha completa do cliente',
      async handler(context) {
        const aggregate = await repositories.customers.findById({
          companyId: scopeOf(context),
          id: context.params['id'] ?? '',
        })

        if (!aggregate) throw new CustomerNotFoundError()

        return {
          kind: 'json',
          status: 200,
          body: {
            data: await toCustomer({
              aggregate,
              ...(module.cipher ? { cipher: module.cipher } : {}),
              encryptedDocuments: config.encryptedDocuments ?? [],
            }),
          },
        }
      },
    },
  ]

  const writeRoutes: ModuleRoute[] = [
    {
      method: 'POST',
      path: '/customers',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.WRITE],
      bodySchema: createCustomerSchema,
      operationId: 'createCustomer',
      summary: 'Cria um cliente',
      async handler(context) {
        const companyId = scopeOf(context)
        const id = await useCases.createCustomer.execute({
          ...(companyId ? { companyId } : {}),
          input: context.body as never,
          settings: await currentSettings(context),
        })

        return { kind: 'json', status: 201, body: { data: { id } } }
      },
    },
    {
      method: 'PATCH',
      path: '/customers/:id',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.WRITE],
      bodySchema: updateCustomerSchema,
      operationId: 'updateCustomer',
      summary: 'Atualiza os campos comuns e os atributos do cliente',
      async handler(context) {
        const companyId = scopeOf(context)
        await useCases.updateCustomer.execute({
          ...(companyId ? { companyId } : {}),
          customerId: context.params['id'] ?? '',
          input: context.body as never,
          settings: await currentSettings(context),
        })

        return { kind: 'empty', status: 204 }
      },
    },
    {
      method: 'PUT',
      path: '/customers/:id/documents',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.WRITE],
      bodySchema: setDocumentSchema,
      operationId: 'setCustomerDocument',
      summary: 'Grava ou substitui um documento do cliente',
      async handler(context) {
        const body = context.body as z.infer<typeof setDocumentSchema>
        const current = await currentSettings(context)

        await useCases.setDocument.execute({
          customerId: context.params['id'] ?? '',
          name: body.name,
          value: body.value,
          catalog: current.documentCatalog,
        })

        return { kind: 'empty', status: 204 }
      },
    },
    {
      method: 'POST',
      path: '/customers/:id/addresses',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.WRITE],
      bodySchema: customerAddressInputSchema,
      operationId: 'addCustomerAddress',
      summary: 'Adiciona um endereço ao cliente',
      async handler(context) {
        const address = await useCases.addAddress.execute({
          customerId: context.params['id'] ?? '',
          address: context.body as never,
        })

        return { kind: 'json', status: 201, body: { data: address } }
      },
    },
    {
      method: 'PATCH',
      path: '/customers/:id/addresses/:addressId',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.WRITE],
      bodySchema: customerAddressInputSchema,
      operationId: 'updateCustomerAddress',
      summary: 'Atualiza um endereço do cliente',
      async handler(context) {
        const address = await useCases.updateAddress.execute({
          customerId: context.params['id'] ?? '',
          addressId: context.params['addressId'] ?? '',
          address: context.body as never,
        })

        return { kind: 'json', status: 200, body: { data: address } }
      },
    },
    {
      method: 'DELETE',
      path: '/customers/:id/addresses/:addressId',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.WRITE],
      operationId: 'removeCustomerAddress',
      summary: 'Remove um endereço do cliente',
      async handler(context) {
        await useCases.removeAddress.execute({
          customerId: context.params['id'] ?? '',
          addressId: context.params['addressId'] ?? '',
        })

        return { kind: 'empty', status: 204 }
      },
    },
  ]

  const settingsRoutes: ModuleRoute[] = [
    {
      method: 'GET',
      path: '/customer-settings',
      scope: ROUTE_SCOPE.USER,
      requiredScopes: [CUSTOMER_SCOPE.READ],
      operationId: 'getCustomerSettings',
      summary: 'Catálogo de documentos e de campos, e a máscara da listagem',
      async handler(context) {
        return { kind: 'json', status: 200, body: { data: await currentSettings(context) } }
      },
    },
    {
      method: 'PUT',
      path: '/customer-settings',
      scope: ROUTE_SCOPE.USER,
      // ADMIN e não WRITE: aqui se desliga máscara de PII e se muda obrigatoriedade de campo.
      requiredScopes: [CUSTOMER_SCOPE.ADMIN],
      bodySchema: updateSettingsSchema,
      operationId: 'updateCustomerSettings',
      summary: 'Altera o catálogo de campos e documentos',
      async handler(context) {
        const companyId = scopeOf(context)
        const updated = await useCases.updateSettings.execute({
          ...(companyId ? { companyId } : {}),
          input: context.body as never,
          ...(context.auth?.userId ? { actorUserId: context.auth.userId } : {}),
        })

        return { kind: 'json', status: 200, body: { data: updated } }
      },
    },
  ]

  return [...readRoutes, ...(write ? writeRoutes : []), ...(settings ? settingsRoutes : [])]
}
