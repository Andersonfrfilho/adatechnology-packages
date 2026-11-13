import https from 'node:https'
import { URL } from 'node:url'
import type { CertificateData } from './SefazXmlSigner'
import { FiscalConnectionError, FiscalTimeoutError } from '../errors/FiscalError'

type SefazFetchOptions = {
  readonly method?: string
  readonly headers?: Record<string, string>
  readonly body?: string
  readonly signal?: AbortSignal
}

/**
 * HTTP client com mTLS (certificado A1) para SEFAZ.
 * Usa `node:https` — funciona em Node e Bun (o `fetch` + `tls` só existe no Bun).
 */
export async function sefazFetch(
  url: string,
  options: SefazFetchOptions,
  certData: CertificateData,
  timeoutMs: number,
  providerLabel = 'SEFAZ',
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    // Bun: extensão nativa tls no fetch
    if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
      return await fetch(url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
        // @ts-expect-error — Bun TLS extension para mTLS
        tls: {
          cert: certData.certificatePem,
          key: certData.privateKeyPem,
          rejectUnauthorized: false,
        },
      })
    }

    return await httpsMtlsRequest(url, options, certData, controller.signal)
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
      throw new FiscalTimeoutError(providerLabel)
    }
    const detail =
      error instanceof Error
        ? [error.message, (error as NodeJS.ErrnoException).code, (error as Error & { cause?: Error }).cause?.message]
            .filter(Boolean)
            .join(' | ')
        : 'erro de rede desconhecido'
    throw new FiscalConnectionError(providerLabel, detail)
  } finally {
    clearTimeout(timer)
  }
}

function httpsMtlsRequest(
  url: string,
  options: SefazFetchOptions,
  certData: CertificateData,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const headers: Record<string, string> = { ...(options.headers ?? {}) }
    if (options.body && !headers['Content-Length'] && !headers['content-length']) {
      headers['Content-Length'] = String(Buffer.byteLength(options.body, 'utf8'))
    }

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method ?? 'GET',
        headers,
        cert: certData.certificatePem,
        key: certData.privateKeyPem,
        // Cadeia ICP-Brasil não está no trust store padrão do Node
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks)
          const responseHeaders = new Headers()
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue
            if (Array.isArray(value)) value.forEach((v) => responseHeaders.append(key, v))
            else responseHeaders.set(key, value)
          }
          resolve(
            new Response(body, {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage,
              headers: responseHeaders,
            }),
          )
        })
        res.on('error', reject)
      },
    )

    const onAbort = () => {
      req.destroy(new Error('AbortError'))
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
    })

    if (options.body) req.write(options.body, 'utf8')
    req.end()
  })
}
