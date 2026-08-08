import { describe, it, expect } from 'bun:test'
import { redact, redactMeta } from './redact'

const CPF_FORMATTED = '529.982.247-25'
const CPF_BARE = '52998224725'
const CNPJ_FORMATTED = '12.345.678/0001-90'
const CNPJ_BARE = '12345678000190'
const EMAIL = 'cliente@transportadora.com.br'
const PHONE_FORMATTED = '(11) 98765-4321'
const PHONE_WITH_COUNTRY_CODE = '+55 11 98765-4321'
const PHONE_BARE = '11987654321'
const ACCESS_KEY = '35240712345678000190570010000012341000012347'

function serialize(value: unknown): string {
  return JSON.stringify(value)
}

describe('redact — camada 1, denylist por nome de chave', () => {
  it('redige as chaves da denylist no primeiro nível', () => {
    const redacted = redactMeta({
      cpf: CPF_BARE,
      cnpj: CNPJ_BARE,
      email: EMAIL,
      phone: PHONE_BARE,
      telefone: PHONE_FORMATTED,
      password: 'hunter2',
      senha: 'hunter2',
      secret: 'shhh',
      token: 'eyJhbGciOi',
      authorization: 'Bearer eyJhbGciOi',
      cookie: 'session=abc',
      certificate: 'MIIEvgIBADAN',
      certificado: 'MIIEvgIBADAN',
      pfx: 'MIIEvgIBADAN',
      xml: '<cteProc><infCte>…</infCte></cteProc>',
      razaoSocial: 'Transportadora Exemplo Ltda',
      nomeFantasia: 'Exemplo Log',
      endereco: 'Rua das Flores, 100',
      logradouro: 'Rua das Flores',
    })

    for (const value of Object.values(redacted)) {
      expect(value).toBe('[REDACTED]')
    }
  })

  it('casa o nome da chave sem diferenciar maiúscula, acento de camelCase ou separador', () => {
    const redacted = redactMeta({
      CPF: CPF_BARE,
      Cnpj: CNPJ_BARE,
      client_email: EMAIL,
      'x-authorization': 'Bearer eyJhbGciOi',
      accessToken: 'eyJhbGciOi',
      clienteCpf: CPF_BARE,
    })

    for (const value of Object.values(redacted)) {
      expect(value).toBe('[REDACTED]')
    }
  })

  it('desce em objeto aninhado e em array de objeto', () => {
    const redacted = redactMeta({
      batchId: 'batch-1',
      remetente: { razaoSocial: 'Transportadora Exemplo Ltda', cnpj: CNPJ_BARE },
      documentos: [
        { nfeDocumentId: 'doc-1', destinatario: { cpf: CPF_BARE } },
        { nfeDocumentId: 'doc-2', destinatario: { cpf: CPF_FORMATTED } },
      ],
    })

    const output = serialize(redacted)
    expect(output).not.toContain(CNPJ_BARE)
    expect(output).not.toContain(CPF_BARE)
    expect(output).not.toContain(CPF_FORMATTED)
    expect(output).not.toContain('Transportadora Exemplo Ltda')
    expect(output).toContain('batch-1')
    expect(output).toContain('doc-1')
    expect(output).toContain('doc-2')
  })

  it('aceita chave extra por configuração', () => {
    const redacted = redactMeta({ apelido: 'Zezinho' }, { extraKeys: ['apelido'] })

    expect(redacted.apelido).toBe('[REDACTED]')
  })
})

describe('redact — camada 2, varredura por forma do valor', () => {
  it('pega CPF cru e formatado em chave que a denylist não cobre', () => {
    const redacted = redactMeta({
      descricao: `motorista ${CPF_FORMATTED} e ajudante ${CPF_BARE}`,
    })

    const output = serialize(redacted)
    expect(output).not.toContain(CPF_FORMATTED)
    expect(output).not.toContain(CPF_BARE)
    expect(output).toContain('motorista')
    expect(output).toContain('ajudante')
  })

  it('pega CNPJ cru e formatado', () => {
    const redacted = redactMeta({ descricao: `${CNPJ_FORMATTED} e ${CNPJ_BARE}` })

    const output = serialize(redacted)
    expect(output).not.toContain(CNPJ_FORMATTED)
    expect(output).not.toContain(CNPJ_BARE)
  })

  it('pega e-mail', () => {
    const redacted = redactMeta({ descricao: `contato ${EMAIL} respondeu` })

    const output = serialize(redacted)
    expect(output).not.toContain(EMAIL)
    expect(output).toContain('respondeu')
  })

  it('pega telefone com e sem DDI', () => {
    const redacted = redactMeta({
      descricao: `${PHONE_FORMATTED} / ${PHONE_WITH_COUNTRY_CODE} / ${PHONE_BARE}`,
    })

    const output = serialize(redacted)
    expect(output).not.toContain(PHONE_FORMATTED)
    expect(output).not.toContain(PHONE_WITH_COUNTRY_CODE)
    expect(output).not.toContain(PHONE_BARE)
  })

  it('também varre a mensagem, não só o meta', () => {
    const message = redact(`importou a nota de ${CNPJ_BARE}`)

    expect(message).not.toContain(CNPJ_BARE)
    expect(message).toContain('importou a nota de')
  })
})

describe('redact — chave de acesso', () => {
  it('mascara guardando só os seis últimos dígitos', () => {
    const redacted = redactMeta({ chaveAcesso: ACCESS_KEY })

    expect(redacted.chaveAcesso).toBe('****012347')
  })

  it('não deixa o CNPJ do emitente escapar dentro da chave', () => {
    const output = serialize(redactMeta({ chaveAcesso: ACCESS_KEY }))

    expect(output).not.toContain(CNPJ_BARE)
    expect(output).not.toContain(ACCESS_KEY)
  })

  it('distingue duas chaves diferentes na mesma linha', () => {
    const otherAccessKey = `${ACCESS_KEY.slice(0, 38)}999999`
    const redacted = redactMeta({ primeira: ACCESS_KEY, segunda: otherAccessKey })

    expect(redacted.primeira).not.toBe(redacted.segunda)
  })
})

describe('redact — o que precisa sobreviver', () => {
  it('deixa intacto identificador opaco, enum, contagem, duração e diagnóstico de erro', () => {
    const meta = {
      companyId: '9f1c2b3a-4d5e-6f70-8a9b-0c1d2e3f4a5b',
      correlationId: 'req-01J8Z9',
      nfeDocumentId: 'doc-42',
      batchId: 'batch-7',
      messageId: 'msg-13',
      status: 'authorized',
      source: 'distribution',
      documentCount: 128,
      durationMs: 1543,
      errorName: 'PostgresError',
      sqlState: '23505',
      constraint: 'nfe_documents_company_id_access_key_unique',
    }

    expect(redactMeta(meta)).toEqual(meta)
  })

  it('não confunde número de negócio com PII', () => {
    const meta = { totalFreight: '1234.56', weightKg: 12345, serie: '001', numero: 1234 }

    expect(redactMeta(meta)).toEqual(meta)
  })

  it('preserva os tipos que não são string nem objeto', () => {
    const meta = { ok: true, nada: null, zero: 0 }

    expect(redactMeta(meta)).toEqual(meta)
  })
})

describe('redact — estruturas hostis', () => {
  it('não lança em referência cíclica e marca o ciclo', () => {
    const node: Record<string, unknown> = { name: 'raiz' }
    node.self = node

    const redacted = redactMeta(node) as Record<string, unknown>

    expect(redacted.name).toBe('raiz')
    expect(redacted.self).toBe('[CIRCULAR]')
  })

  it('corta acima da profundidade máxima em vez de estourar a pilha', () => {
    let deep: Record<string, unknown> = { cpf: CPF_BARE }
    for (let level = 0; level < 40; level += 1) {
      deep = { nested: deep }
    }

    const output = serialize(redactMeta(deep))
    expect(output).toContain('[TRUNCATED]')
    expect(output).not.toContain(CPF_BARE)
  })

  it('respeita profundidade máxima configurada', () => {
    const redacted = redactMeta({ a: { b: { c: 'fundo' } } }, { maxDepth: 2 }) as Record<
      string,
      Record<string, unknown>
    >

    expect(redacted.a.b).toBe('[TRUNCATED]')
  })

  it('não lança em nenhum valor exótico', () => {
    expect(() => redact(undefined)).not.toThrow()
    expect(() => redact(Symbol('x'))).not.toThrow()
    expect(() => redact(() => undefined)).not.toThrow()
    expect(() => redact(new Error('falhou'))).not.toThrow()
    expect(() => redact(new Date())).not.toThrow()
    expect(() => redact(BigInt(10))).not.toThrow()
  })
})

describe('redact — custo', () => {
  it('roda em todo log sem pesar', () => {
    const meta = {
      companyId: '9f1c2b3a-4d5e-6f70-8a9b-0c1d2e3f4a5b',
      correlationId: 'req-01J8Z9',
      documentCount: 128,
      durationMs: 1543,
      remetente: { razaoSocial: 'Transportadora Exemplo Ltda', cnpj: CNPJ_BARE },
      descricao: `motorista ${CPF_FORMATTED} contato ${EMAIL}`,
    }

    const startedAt = performance.now()
    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      redactMeta(meta)
    }
    const elapsedMs = performance.now() - startedAt

    expect(elapsedMs).toBeLessThan(2000)
  })
})
