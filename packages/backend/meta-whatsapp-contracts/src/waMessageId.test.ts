import { describe, expect, it } from 'bun:test'
import { hashWaMessageId } from './waMessageId'

const EMBEDDED_PHONE = '5516993056772'
const WAMID = 'wamid.HBgNNTUxNjk5MzA1Njc3MhUCABEYEjBGRDc4OEMyMUFFQzM1MkFFRAA='

describe('hashWaMessageId', () => {
  it('confirma que o wamid carrega o telefone do destinatário', () => {
    const decoded = Buffer.from(WAMID.replace('wamid.', ''), 'base64').toString('binary')

    expect(decoded).toContain(EMBEDDED_PHONE)
  })

  it('devolve chave sem o telefone que o wamid embute', () => {
    const hashed = hashWaMessageId(WAMID)

    expect(hashed).toBeDefined()
    expect(hashed).not.toContain(EMBEDDED_PHONE)
    expect(hashed).toHaveLength(16)
  })

  it('mantém a mesma chave para o mesmo id, para os status de um envio se juntarem', () => {
    expect(hashWaMessageId(WAMID)).toBe(hashWaMessageId(WAMID))
  })

  it('separa ids diferentes', () => {
    expect(hashWaMessageId('wamid.A')).not.toBe(hashWaMessageId('wamid.B'))
  })

  it('repassa undefined sem inventar chave', () => {
    expect(hashWaMessageId(undefined)).toBeUndefined()
  })
})
