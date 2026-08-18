/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rota dedicada do webhook de catálogo. A Meta configura callback **por objeto**, e o objeto
 * "catalog" é assinado separadamente do WhatsApp Business Account — cada um com sua URL. Dividir a
 * rota de mensagens obrigaria o handler a desempatar por `object`, e um payload novo cairia no
 * ramo errado em silêncio.
 */

import { InvalidCatalogWebhookSignatureError } from '@adatechnology/catalog-contracts'
import { isValidWebhookChallenge } from '@adatechnology/meta-graph-core'
import type { ModuleRoute } from '@adatechnology/module-http'

import type { CatalogModule } from '../CatalogModule'

export const CATALOG_WEBHOOK_PATH = '/webhook/catalog'

export function buildCatalogWebhookRoutes(module: CatalogModule): ModuleRoute[] {
  const receiveCatalogWebhook = module.useCases?.receiveCatalogWebhook
  const webhook = module.config?.webhook
  if (!receiveCatalogWebhook || !webhook) return []

  return [
    {
      method: 'GET',
      path: CATALOG_WEBHOOK_PATH,
      scope: 'public',
      operationId: 'verifyCatalogWebhook',
      summary: 'Desafio de verificação que a Meta faz ao salvar a URL do webhook de catálogo',
      async handler(context) {
        const challenge = context.query['hub.challenge'] ?? null
        const isValid = isValidWebhookChallenge({
          mode: context.query['hub.mode'] ?? null,
          token: context.query['hub.verify_token'] ?? null,
          challenge,
          expectedToken: webhook.verifyToken,
        })
        if (!isValid) throw new InvalidCatalogWebhookSignatureError()

        // A Meta exige o desafio ecoado como texto puro; JSON reprova a verificação.
        return { kind: 'text', status: 200, body: challenge as string }
      },
    },

    {
      method: 'POST',
      path: CATALOG_WEBHOOK_PATH,
      scope: 'public',
      operationId: 'receiveCatalogWebhook',
      summary: 'Recebe eventos de catálogo da Meta Commerce',
      async handler(context) {
        // `rawBody` e não o corpo já parseado: o HMAC é sobre os bytes exatos, e um re-serialize
        // muda espaçamento e ordem de chave, invalidando toda assinatura.
        const result = await receiveCatalogWebhook.execute({
          rawBody: Buffer.from(context.rawBody ?? new Uint8Array()),
          signatureHeader: context.headers['x-hub-signature-256'],
        })
        // 200 sempre que a assinatura confere: a Meta desativa webhook que responde erro, e evento
        // que não sabemos tratar é problema nosso, não da entrega.
        return { kind: 'json', status: 200, body: { data: result } }
      },
    },
  ]
}
