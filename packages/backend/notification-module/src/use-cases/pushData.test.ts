import { describe, expect, it } from 'bun:test'

import { buildPushData } from './pushData'

describe('buildPushData', () => {
  it('leva o id da notificação e o caminho relativo do link', () => {
    expect(buildPushData({ notificationId: 'n1', payload: { link: '/reservas?q=AB12' } })).toEqual({
      notificationId: 'n1',
      url: '/reservas?q=AB12',
    })
  })

  it('descarta link externo, protocolo-relativo ou que não é texto', () => {
    for (const link of ['https://x.test/a', '//x.test/a', 'javascript:alert(1)', 42, undefined]) {
      expect(buildPushData({ notificationId: 'n1', payload: { link } })).toEqual({ notificationId: 'n1' })
    }
  })
})
