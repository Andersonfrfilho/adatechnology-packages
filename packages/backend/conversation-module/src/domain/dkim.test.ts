/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14: o resultado de DKIM viaja com a mensagem recebida, porque o provedor não o entrega pronto.
 * O que se decide aqui é a leitura do veredito, e ela tem uma assimetria que vale escrever: uma
 * falha **transitória** (DNS fora do ar) é `unverifiable`, nunca `not_aligned` — dizer "verificado e
 * não bate" sobre algo que não chegou a ser verificado é afirmar o que não se sabe. E o resultado
 * **não se refaz depois**: a chave pública pode ter girado, e o veredito de amanhã não é prova do
 * que valia quando a mensagem chegou.
 *
 * As fixtures são **sintéticas**: um par de chaves gerado no próprio teste assina mensagens montadas
 * aqui, e o DNS é um resolvedor injetado que devolve a chave pública. E-mail real anonimizado não
 * serviria — trocar um endereço quebra a assinatura, e o teste passaria a medir a anonimização.
 */

import { generateKeyPairSync } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'bun:test'

import { createDkimVerifier, resolveDkimAlignment } from './dkim'

const SIGNING_DOMAIN = 'example.com'
const SELECTOR = 'test'

let publicKeyRecord: string
let signedMessage: Buffer
let signedByOtherDomain: Buffer
let unsignedMessage: Buffer

function buildMessage(from: string, body: string): Buffer {
  return Buffer.from(
    [
      `From: Quem Responde <${from}>`,
      'To: Atendimento <atendimento@example.net>',
      'Subject: Resposta',
      'Date: Thu, 26 Sep 2026 12:00:00 +0000',
      'Message-ID: <abc123@example.com>',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
      '',
    ].join('\r\n'),
  )
}

/** Um resolvedor que só conhece a chave do teste; qualquer outro nome não existe (`none`). */
function resolverFor(records: Readonly<Record<string, string>>) {
  return async (name: string, recordType: string): Promise<string[][]> => {
    if (recordType !== 'TXT') throw new Error(`tipo inesperado: ${recordType}`)
    const record = records[name]
    if (record === undefined) {
      const error: NodeJS.ErrnoException = new Error(`ENOTFOUND ${name}`)
      error.code = 'ENOTFOUND'
      throw error
    }
    return [[record]]
  }
}

/**
 * ⚠️ A tipagem publicada da `mailauth@5.0.3` descreve `dkimSign` recebendo **uma** assinatura no
 * objeto raiz, e a implementação só assina o que vem em `signatureData` — passar como o tipo manda
 * compila e devolve mensagem sem assinatura. Declaramos aqui a forma que a implementação aceita, em
 * vez de seguir a declaração errada. Só o teste assina; o pacote em si apenas verifica.
 */
type DkimSignature = {
  readonly algorithm: string
  readonly canonicalization: string
  readonly privateKey: string
  readonly selector: string
  readonly signingDomain: string
}
type DkimSign = (
  input: Buffer,
  options: { readonly signatureData: readonly DkimSignature[] },
) => Promise<{ readonly signatures: string }>

async function sign(message: Buffer, domain: string, privateKey: string): Promise<Buffer> {
  const { dkimSign } = (await import('mailauth/lib/dkim/sign')) as unknown as { dkimSign: DkimSign }
  const signature = await dkimSign(message, {
    signatureData: [
      {
        algorithm: 'rsa-sha256',
        canonicalization: 'relaxed/relaxed',
        privateKey,
        selector: SELECTOR,
        signingDomain: domain,
      },
    ],
  })
  const headers = String(signature.signatures)
  return Buffer.concat([Buffer.from(headers.endsWith('\r\n') ? headers : `${headers}\r\n`), message])
}

beforeAll(async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  })
  const publicKeyBody = publicKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  publicKeyRecord = `v=DKIM1; k=rsa; p=${publicKeyBody}`

  unsignedMessage = buildMessage(`quem.responde@${SIGNING_DOMAIN}`, 'Segue a resposta.')
  signedMessage = await sign(unsignedMessage, SIGNING_DOMAIN, privateKey)
  signedByOtherDomain = await sign(
    buildMessage(`quem.responde@${SIGNING_DOMAIN}`, 'Segue a resposta.'),
    'outro-dominio.test',
    privateKey,
  )
})

describe('leitura do veredito de DKIM', () => {
  it('assinatura válida e alinhada ao From é `aligned`', async () => {
    const verifier = createDkimVerifier({
      resolveDns: resolverFor({ [`${SELECTOR}._domainkey.${SIGNING_DOMAIN}`]: publicKeyRecord }),
    })
    expect(await verifier.verify(signedMessage)).toBe('aligned')
  })

  it('assinatura de outro domínio que não o do From é `not_aligned`', async () => {
    const verifier = createDkimVerifier({
      resolveDns: resolverFor({
        [`${SELECTOR}._domainkey.outro-dominio.test`]: publicKeyRecord,
        [`${SELECTOR}._domainkey.${SIGNING_DOMAIN}`]: publicKeyRecord,
      }),
    })
    expect(await verifier.verify(signedByOtherDomain)).toBe('not_aligned')
  })

  it('corpo adulterado depois da assinatura é `not_aligned`', async () => {
    const tampered = Buffer.from(signedMessage.toString('utf8').replace('Segue a resposta.', 'Segue outra resposta.'))
    const verifier = createDkimVerifier({
      resolveDns: resolverFor({ [`${SELECTOR}._domainkey.${SIGNING_DOMAIN}`]: publicKeyRecord }),
    })
    expect(await verifier.verify(tampered)).toBe('not_aligned')
  })

  it('mensagem sem assinatura nenhuma é `absent`', async () => {
    const verifier = createDkimVerifier({ resolveDns: resolverFor({}) })
    expect(await verifier.verify(unsignedMessage)).toBe('absent')
  })

  it('chave publicada que não é a que assinou é `not_aligned`', async () => {
    const { publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { format: 'pem', type: 'spki' },
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    })
    const otherRecord = `v=DKIM1; k=rsa; p=${publicKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')}`
    const verifier = createDkimVerifier({
      resolveDns: resolverFor({ [`${SELECTOR}._domainkey.${SIGNING_DOMAIN}`]: otherRecord }),
    })
    expect(await verifier.verify(signedMessage)).toBe('not_aligned')
  })

  it('DNS fora do ar é `unverifiable`, nunca `not_aligned`', async () => {
    const verifier = createDkimVerifier({
      resolveDns: async () => {
        const error: NodeJS.ErrnoException = new Error('servidor de DNS indisponível')
        error.code = 'ESERVFAIL'
        throw error
      },
    })
    expect(await verifier.verify(signedMessage)).toBe('unverifiable')
  })

  it('DNS que não responde no prazo é `unverifiable`', async () => {
    const verifier = createDkimVerifier({
      dnsTimeoutMs: 20,
      resolveDns: () => new Promise(() => undefined),
    })
    expect(await verifier.verify(signedMessage)).toBe('unverifiable')
  })
})

describe('a política que lê os resultados', () => {
  it('sem assinatura, ou só com `none`, é `absent`', () => {
    expect(resolveDkimAlignment([])).toBe('absent')
    expect(resolveDkimAlignment([{ status: { result: 'none' } }])).toBe('absent')
  })

  it('uma alinhada basta, mesmo com outra falhando', () => {
    expect(
      resolveDkimAlignment([
        { status: { aligned: false, result: 'fail' } },
        { status: { aligned: 'example.com', result: 'pass' } },
      ]),
    ).toBe('aligned')
  })

  it('`pass` sem alinhamento não é `aligned`', () => {
    expect(resolveDkimAlignment([{ status: { aligned: false, result: 'pass' } }])).toBe('not_aligned')
  })

  it('uma sem veredito transitório basta para `unverifiable` — ela podia ser a decisiva', () => {
    expect(
      resolveDkimAlignment([{ status: { aligned: false, result: 'fail' } }, { status: { result: 'temperror' } }]),
    ).toBe('unverifiable')
  })

  it('mas a alinhada vence a transitória', () => {
    expect(
      resolveDkimAlignment([
        { status: { result: 'temperror' } },
        { status: { aligned: 'example.com', result: 'pass' } },
      ]),
    ).toBe('aligned')
  })

  it('o resultado é sempre um valor do vocabulário do contrato', () => {
    const vocabulary = ['aligned', 'not_aligned', 'unverifiable', 'absent']
    for (const result of ['pass', 'fail', 'neutral', 'none', 'temperror', 'permerror', 'policy']) {
      expect(vocabulary).toContain(resolveDkimAlignment([{ status: { result } }]))
    }
  })
})
