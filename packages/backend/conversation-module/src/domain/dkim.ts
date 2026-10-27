/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14: o veredito de DKIM da mensagem recebida. A `mailauth` faz a criptografia e o alinhamento
 * relaxado (domínio organizacional, pela lista de sufixos públicos) — aqui só se lê o que ela
 * concluiu e se traduz para o vocabulário do contrato.
 *
 * A assimetria que este arquivo existe para garantir: falha **transitória** vira `unverifiable`, e
 * só o que a `mailauth` conseguiu verificar e reprovar vira `not_aligned`. E o veredito **não se
 * refaz depois**: a chave pode ter girado, e o resultado de amanhã não é prova do que valia quando a
 * mensagem chegou — quem chama grava o que recebeu e nunca recalcula.
 *
 * Sem rede aqui: quem resolve DNS é o `resolveDns` do host, e é isso que faz o teste rodar sem sair
 * da máquina.
 */

import type { DkimResult } from '@adatechnology/conversation-contracts'

const DEFAULT_DNS_TIMEOUT_MS = 5_000

/** Só as falhas que a `mailauth` marca como "tente de novo depois". */
const TRANSIENT_RESULTS = new Set(['temperror', 'temperr'])

export type DkimSignatureVerification = {
  readonly status: {
    readonly result: string
    readonly aligned?: string | false
  }
}

export type DkimDnsResolver = (name: string, recordType: string) => Promise<string[][] | string[]>

export type CreateDkimVerifierInput = {
  readonly resolveDns: DkimDnsResolver
  readonly dnsTimeoutMs?: number
}

export type DkimVerifier = {
  verify(rawMime: Uint8Array): Promise<DkimResult>
}

/**
 * Decide a partir dos resultados por assinatura do MIME. Mensagem com mais de uma assinatura decide
 * pela melhor: uma alinhada basta, e uma sem veredito impede concluir que nenhuma servia.
 */
export function resolveDkimAlignment(signatures: readonly DkimSignatureVerification[]): DkimResult {
  if (signatures.length === 0 || signatures.every((item) => item.status.result === 'none')) {
    return 'absent'
  }

  if (signatures.some((item) => item.status.result === 'pass' && Boolean(item.status.aligned))) {
    return 'aligned'
  }

  if (signatures.some((item) => TRANSIENT_RESULTS.has(item.status.result))) {
    return 'unverifiable'
  }

  return 'not_aligned'
}

export function createDkimVerifier(input: CreateDkimVerifierInput): DkimVerifier {
  const dnsTimeoutMs = input.dnsTimeoutMs ?? DEFAULT_DNS_TIMEOUT_MS

  return {
    async verify(rawMime) {
      const { dkimVerify } = await import('mailauth')
      const result = await dkimVerify(Buffer.from(rawMime), {
        resolver: (name: string, recordType: string) => withTimeout(input.resolveDns(name, recordType), dnsTimeoutMs),
      })

      return resolveDkimAlignment(result.results as readonly DkimSignatureVerification[])
    },
  }
}

/**
 * A `mailauth` não impõe prazo ao resolvedor, e um DNS lento travaria a verificação pelo tempo que
 * ele demorasse. Estourar o prazo vira rejeição, que ela classifica como falha transitória — o
 * mesmo caminho de um resolvedor que lança na hora.
 */
function withTimeout<TResult>(promise: Promise<TResult>, timeoutMs: number): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('dns resolver timeout'))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error('dns resolver failure'))
      })
  })
}
