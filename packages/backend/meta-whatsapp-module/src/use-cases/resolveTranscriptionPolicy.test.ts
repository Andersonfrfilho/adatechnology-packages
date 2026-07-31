/**
 * O que estes testes travam é o tri-state. Se `transcriptionEnabled: null` colapsar para `false`,
 * atualizar o módulo desliga a transcrição de todo host que a tinha ligada por ambiente; se `false`
 * colapsar para o padrão, desligar no painel não faz nada. Os dois erros são silenciosos.
 */

import { describe, expect, it } from 'bun:test'

import { createTranscriptionPolicyResolver, type TranscriptionPolicyDefaults } from './resolveTranscriptionPolicy'
import type { SettingsRepository } from '../repositories/SettingsRepository'
import { TRANSCRIPTION_MODE } from '../transcription.types'

const COMPANY_ID = '22222222-2222-2222-2222-222222222222'

function resolverWith(
  stored: { transcriptionEnabled: boolean | null; transcriptionMode: string | null },
  defaults: TranscriptionPolicyDefaults = { isEnabled: true, mode: TRANSCRIPTION_MODE.ON_DEMAND },
) {
  const settingsRepository = {
    get: async () => ({
      templateName: '',
      templateLanguage: 'pt_BR',
      templateVariables: [],
      welcomeMessage: '',
      farewellMessage: '',
      ...stored,
    }),
  } as unknown as SettingsRepository

  return createTranscriptionPolicyResolver({ settingsRepository, defaults })
}

describe('createTranscriptionPolicyResolver', () => {
  it('herda o padrão do host quando o painel não decidiu', async () => {
    const resolve = resolverWith(
      { transcriptionEnabled: null, transcriptionMode: null },
      { isEnabled: true, mode: TRANSCRIPTION_MODE.AUTO },
    )

    expect(await resolve(COMPANY_ID)).toEqual({ isEnabled: true, mode: TRANSCRIPTION_MODE.AUTO })
  })

  // O erro que `??` evita e `||` cometeria: desligar no painel não faria efeito nenhum num deploy
  // com transcrição ligada por ambiente.
  it('respeita `false` gravado no painel mesmo com o padrão do host ligado', async () => {
    const resolve = resolverWith(
      { transcriptionEnabled: false, transcriptionMode: null },
      { isEnabled: true, mode: TRANSCRIPTION_MODE.AUTO },
    )

    expect((await resolve(COMPANY_ID)).isEnabled).toBe(false)
  })

  it('respeita `true` gravado no painel mesmo com o padrão do host desligado', async () => {
    const resolve = resolverWith(
      { transcriptionEnabled: true, transcriptionMode: null },
      { isEnabled: false, mode: TRANSCRIPTION_MODE.ON_DEMAND },
    )

    expect((await resolve(COMPANY_ID)).isEnabled).toBe(true)
  })

  it('o modo do painel tem precedência sobre o do host', async () => {
    const resolve = resolverWith(
      { transcriptionEnabled: true, transcriptionMode: 'auto' },
      { isEnabled: true, mode: TRANSCRIPTION_MODE.ON_DEMAND },
    )

    expect((await resolve(COMPANY_ID)).mode).toBe(TRANSCRIPTION_MODE.AUTO)
  })

  // A coluna é varchar, então o banco aceita qualquer string: valor legado ou digitado à mão não
  // pode virar um modo que ninguém trata.
  it('cai no padrão do host quando o modo gravado é desconhecido', async () => {
    const resolve = resolverWith(
      { transcriptionEnabled: true, transcriptionMode: 'sempre-que-der' },
      { isEnabled: true, mode: TRANSCRIPTION_MODE.ON_DEMAND },
    )

    expect((await resolve(COMPANY_ID)).mode).toBe(TRANSCRIPTION_MODE.ON_DEMAND)
  })
})
