/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { EvolutionError, EvolutionUnsupportedError } from './errors'
import type { EvolutionConfig, EvolutionConnectionState, EvolutionFetch, EvolutionSendResult } from './types'

const DEFAULT_TIMEOUT_MS = 15_000

type SendMediaParams = {
  to: string
  mimeType: string
  filename: string
  caption?: string
  buffer?: Buffer | undefined
  mediaId?: string | undefined
}

/** Só dígitos: o Evolution aceita `5516999998888` e não aceita `+55 (16) 99999-8888`. */
export function normalizeEvolutionNumber(to: string): string {
  const digits = to.replace(/\D/g, '')
  if (digits.length < 8) throw new EvolutionError('invalid destination number', 400)
  return digits
}

function mediaTypeOf(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

/**
 * Canal de WhatsApp pelo Evolution API v2. Implementa por estrutura o `ChannelAdapterInterface` do
 * meta-whatsapp-contracts (sem importá-lo: os dois pacotes seguem independentes), então o motor de
 * conversa e a ponte de notificação usam o Evolution exatamente como usam a Meta.
 *
 * O que o Evolution não tem fica explícito: modelo aprovado (`sendTemplate`) e reuso de `mediaId`
 * recusam com erro definitivo, e a lista interativa sai como texto numerado.
 */
export class EvolutionWhatsAppChannel {
  private readonly baseUrl: string
  private readonly instance: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly doFetch: EvolutionFetch

  constructor(config: EvolutionConfig) {
    if (!config.baseUrl || !config.instance || !config.apiKey) {
      throw new EvolutionError('baseUrl, instance and apiKey are required')
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.instance = encodeURIComponent(config.instance)
    this.apiKey = config.apiKey
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.doFetch = config.fetch ?? ((url, init) => fetch(url, init))
  }

  async sendText(to: string, body: string): Promise<EvolutionSendResult> {
    const response = await this.request('POST', `/message/sendText/${this.instance}`, {
      number: normalizeEvolutionNumber(to),
      text: body,
    })
    return { externalMessageId: readMessageId(response) }
  }

  async sendMedia(params: SendMediaParams): Promise<EvolutionSendResult & { mediaId?: string | undefined }> {
    if (params.buffer === undefined) throw new EvolutionUnsupportedError('mediaId reuse')
    const response = await this.request('POST', `/message/sendMedia/${this.instance}`, {
      number: normalizeEvolutionNumber(params.to),
      mediatype: mediaTypeOf(params.mimeType),
      mimetype: params.mimeType,
      fileName: params.filename,
      ...(params.caption === undefined ? {} : { caption: params.caption }),
      media: params.buffer.toString('base64'),
    })
    return { externalMessageId: readMessageId(response) }
  }

  /** Sem parâmetros: o Evolution não tem modelo aprovado, e a assinatura menor continua satisfazendo a porta. */
  async sendTemplate(): Promise<EvolutionSendResult> {
    throw new EvolutionUnsupportedError('approved templates')
  }

  async sendInteractiveList(params: {
    to: string
    body: string
    buttonLabel: string
    rows: { id: string; title: string }[]
  }): Promise<EvolutionSendResult> {
    const lines = params.rows.map((row, index) => `${index + 1}. ${row.title}`)
    return this.sendText(params.to, [params.body, ...lines].join('\n'))
  }

  async fetchMediaAsBase64(mediaId: string): Promise<{ data: string; mimeType: string }> {
    const response = await this.request('POST', `/chat/getBase64FromMediaMessage/${this.instance}`, {
      message: { key: { id: mediaId } },
    })
    const base64 = (response as { base64?: unknown }).base64
    const mimetype = (response as { mimetype?: unknown }).mimetype
    if (typeof base64 !== 'string') throw new EvolutionError('unexpected media response')
    return { data: base64, mimeType: typeof mimetype === 'string' ? mimetype : 'application/octet-stream' }
  }

  async getConnectionState(): Promise<EvolutionConnectionState> {
    const response = await this.request('GET', `/instance/connectionState/${this.instance}`)
    const state = (response as { instance?: { state?: unknown } }).instance?.state
    return state === 'open' || state === 'connecting' ? state : 'close'
  }

  /** O QR que o dono lê para conectar o número. Expira em segundos: quem chama renova. */
  async getQrCode(): Promise<{ base64: string | null; pairingCode: string | null }> {
    const response = await this.request('GET', `/instance/connect/${this.instance}`)
    const { base64, pairingCode } = response as { base64?: unknown; pairingCode?: unknown }
    return {
      base64: typeof base64 === 'string' ? base64 : null,
      pairingCode: typeof pairingCode === 'string' ? pairingCode : null,
    }
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.doFetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', apikey: this.apiKey },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      })
      if (!response.ok) throw new EvolutionError(`evolution responded ${response.status}`, response.status)
      return (await response.json()) as unknown
    } catch (cause) {
      if (cause instanceof EvolutionError) throw cause
      // Rede, DNS ou timeout: sem `statusCode`, a ponte trata como tentar de novo.
      throw new EvolutionError('evolution request failed', undefined, { cause })
    } finally {
      clearTimeout(timer)
    }
  }
}

function readMessageId(response: unknown): string | null {
  const id = (response as { key?: { id?: unknown } }).key?.id
  return typeof id === 'string' ? id : null
}
