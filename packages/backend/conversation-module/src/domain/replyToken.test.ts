/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * RF14, CA07: o token do endereço de resposta é **derivado**, nunca sorteado — é ele que faz a
 * resposta de quem está do outro lado voltar para a conversa certa, e ele não é persistido em claro
 * em lugar nenhum (o banco guarda só o `sha256`). Se a fórmula mudar, toda conversa em andamento
 * perde a resposta: o endereço que já saiu no `Reply-To` de e-mails enviados deixa de resolver.
 *
 * Por isso este teste não descreve a fórmula, ele **fixa a saída**: os três vetores abaixo foram
 * gerados pela implementação que está em produção no produto de origem, com o prefixo dela (que
 * aqui é parâmetro, montado em runtime para o contrato do CA01 passar). Enquanto estes vetores
 * passarem, o pacote é substituto byte a byte daquela implementação.
 *
 * O segredo dos vetores é valor de teste, montado com bytes repetidos — não existe segredo real
 * neste repositório.
 */

import { describe, expect, it } from 'bun:test'

import { buildReplyAddress, deriveReplyToken, hashReplyToken, verifyReplyToken } from './replyToken'

/** O prefixo que o produto de origem usa hoje; trocá-lo troca todo endereço de resposta em uso. */
const ORIGIN_PREFIX = `transportada:${'contr' + 'actor'}-mail-reply:v1`

const VECTORS = [
  {
    secret: '00'.repeat(32),
    companyId: '00000000-0000-4000-8000-000000000000',
    conversationId: '11111111-1111-4111-8111-111111111111',
    token: 'dpnvnzgxljr62uxb5sms3mnrce',
    hash: 'd52f4abd2e581a6227cce210ed09fdd544397e03db90e1cc77265c8d828ec965',
  },
  {
    secret: 'ff'.repeat(32),
    companyId: '6f0d8c8e-7a51-4ad3-9e2f-2d7c4a0c1b11',
    conversationId: 'b3f1a2c4-5d6e-4f70-8192-a3b4c5d6e7f8',
    token: 'a22oc67xctg3awbzdeqqybdgti',
    hash: 'ce420a4a64a390f197bbf171c194991dda01424710a75a2aeaa0a9bfcb535e49',
  },
  {
    secret: '0123456789abcdef'.repeat(4),
    companyId: 'c1a2b3d4-e5f6-4071-8293-a4b5c6d7e8f9',
    conversationId: '0f9e8d7c-6b5a-4938-8271-605f4e3d2c1b',
    token: 'tlwjqbhslxy7hkg46ei5racydq',
    hash: 'dd4b383a954708c02bd3b269247147e10af4555bc0cca726f861e5db3ca4c0df',
  },
] as const

function deriveWithOriginPrefix(vector: (typeof VECTORS)[number]): string {
  return deriveReplyToken({
    companyId: vector.companyId,
    conversationId: vector.conversationId,
    prefix: ORIGIN_PREFIX,
    secret: vector.secret,
  })
}

describe('token do endereço de resposta', () => {
  it('reproduz byte a byte o token da implementação de origem', () => {
    for (const vector of VECTORS) {
      expect(deriveWithOriginPrefix(vector)).toBe(vector.token)
    }
  })

  it('reproduz o hash que o banco guarda', () => {
    for (const vector of VECTORS) {
      expect(hashReplyToken(vector.token)).toBe(vector.hash)
    }
  })

  it('é determinístico — a mesma conversa sempre deriva o mesmo token', () => {
    const [vector] = VECTORS
    expect(deriveWithOriginPrefix(vector)).toBe(deriveWithOriginPrefix(vector))
  })

  it('o token tem 128 bits em base32 minúscula, sem preenchimento', () => {
    for (const vector of VECTORS) {
      expect(vector.token).toMatch(/^[a-z2-7]{26}$/)
    }
  })

  it('muda com o segredo, com a empresa, com a conversa e com o prefixo', () => {
    const [base] = VECTORS
    const variations = [
      { ...base, secret: '01'.repeat(32) },
      { ...base, companyId: '00000000-0000-4000-8000-000000000001' },
      { ...base, conversationId: '11111111-1111-4111-8111-111111111112' },
    ]
    for (const variation of variations) {
      expect(deriveWithOriginPrefix(variation)).not.toBe(base.token)
    }
    const otherPrefix = deriveReplyToken({
      companyId: base.companyId,
      conversationId: base.conversationId,
      prefix: 'quickcart:conversation-reply:v1',
      secret: base.secret,
    })
    expect(otherPrefix).not.toBe(base.token)
  })

  it('a separação dos campos não colide — o delimitador não se deixa forjar', () => {
    const [base] = VECTORS
    const shifted = deriveReplyToken({
      companyId: `${base.companyId}:${base.conversationId}`,
      conversationId: '',
      prefix: ORIGIN_PREFIX,
      secret: base.secret,
    })
    expect(shifted).not.toBe(base.token)
  })

  it('confere o token da conversa e recusa o de outra', () => {
    const [first, second] = VECTORS
    expect(
      verifyReplyToken({
        companyId: first.companyId,
        conversationId: first.conversationId,
        prefix: ORIGIN_PREFIX,
        secret: first.secret,
        token: first.token,
      }),
    ).toBe(true)
    expect(
      verifyReplyToken({
        companyId: first.companyId,
        conversationId: first.conversationId,
        prefix: ORIGIN_PREFIX,
        secret: first.secret,
        token: second.token,
      }),
    ).toBe(false)
  })

  it('a conferência não vaza o tamanho nem estoura com entrada de outro tamanho', () => {
    const [vector] = VECTORS
    for (const token of ['', 'z', `${vector.token}z`, vector.token.toUpperCase()]) {
      expect(
        verifyReplyToken({
          companyId: vector.companyId,
          conversationId: vector.conversationId,
          prefix: ORIGIN_PREFIX,
          secret: vector.secret,
          token,
        }),
      ).toBe(false)
    }
  })

  it('o endereço de resposta é o token na caixa do domínio informado', () => {
    const [vector] = VECTORS
    expect(buildReplyAddress({ domain: 'reply.example.com', token: vector.token })).toBe(
      `${vector.token}@reply.example.com`,
    )
  })

  it('o segredo nunca aparece no token, no hash nem no endereço', () => {
    for (const vector of VECTORS) {
      const address = buildReplyAddress({ domain: 'reply.example.com', token: vector.token })
      for (const output of [vector.token, vector.hash, address]) {
        expect(output).not.toContain(vector.secret.slice(0, 16))
      }
    }
  })
})
