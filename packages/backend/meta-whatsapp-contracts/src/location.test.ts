import { describe, expect, it } from 'bun:test'
import { whatsAppLocationSchema, whatsAppMessageSchema } from './webhook.types'

describe('whatsAppLocationSchema', () => {
  it('aceita o payload de localização documentado pela Cloud API', () => {
    const result = whatsAppLocationSchema.safeParse({
      latitude: -20.5386,
      longitude: -47.4008,
      name: 'Casa',
      address: 'Rua Exemplo, 123',
      url: 'https://maps.example.com',
    })

    expect(result.success).toBe(true)
  })

  it('aceita latitude e longitude sem name/address/url', () => {
    const result = whatsAppLocationSchema.safeParse({ latitude: -20.5386, longitude: -47.4008 })

    expect(result.success).toBe(true)
  })

  it('recusa latitude fora da faixa -90..90', () => {
    const result = whatsAppLocationSchema.safeParse({ latitude: 91, longitude: 0 })

    expect(result.success).toBe(false)
  })

  it('recusa longitude fora da faixa -180..180', () => {
    const result = whatsAppLocationSchema.safeParse({ latitude: 0, longitude: 181 })

    expect(result.success).toBe(false)
  })

  it('recusa payload sem latitude', () => {
    const result = whatsAppLocationSchema.safeParse({ longitude: -47.4008 })

    expect(result.success).toBe(false)
  })

  it('recusa payload sem longitude', () => {
    const result = whatsAppLocationSchema.safeParse({ latitude: -20.5386 })

    expect(result.success).toBe(false)
  })
})

describe('whatsAppMessageSchema com location', () => {
  it('aceita mensagem de tipo location com o grupo de coordenadas', () => {
    const result = whatsAppMessageSchema.safeParse({
      id: 'wamid.1',
      from: '5511999999999',
      type: 'location',
      location: { latitude: -20.5386, longitude: -47.4008 },
      timestamp: '1700000000',
    })

    expect(result.success).toBe(true)
  })

  it('location continua opcional para mensagens de outros tipos', () => {
    const result = whatsAppMessageSchema.safeParse({
      id: 'wamid.1',
      from: '5511999999999',
      type: 'text',
      text: { body: 'oi' },
      timestamp: '1700000000',
    })

    expect(result.success).toBe(true)
  })
})
