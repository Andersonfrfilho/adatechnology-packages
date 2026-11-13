import type { SettingsRepository } from '../repositories/SettingsRepository'
import { TRANSCRIPTION_MODE, type TranscriptionMode } from '../transcription.types'

/**
 * Política efetiva de transcrição de uma empresa.
 *
 * A separação que este arquivo existe para manter: **ambiente decide se é POSSÍVEL, settings decide
 * se é para FAZER.** A capacidade (engine, chave, storage que sabe reler) é injetada pelo host e é
 * por deploy — chave de API não vai para tabela de configuração de tenant. Já "transcrever ou não" e
 * "automático ou sob demanda" são decisão de operação de cada empresa, e pedir deploy para mudar
 * isso é o que transforma um interruptor em ticket.
 */
export type TranscriptionPolicy = {
  readonly isEnabled: boolean
  readonly mode: TranscriptionMode
}

export type TranscriptionPolicyDefaults = {
  /** O que vale quando o painel não decidiu. Tipicamente vem do ambiente do host. */
  readonly isEnabled: boolean
  readonly mode: TranscriptionMode
}

export type ResolveTranscriptionPolicyDependencies = {
  readonly settingsRepository: SettingsRepository
  readonly defaults: TranscriptionPolicyDefaults
}

/**
 * Resolve a política por empresa, com o padrão do host como base.
 *
 * Uma consulta a `settings` por áudio transcrito. Não é cacheado de propósito: é uma leitura por
 * chave primária, acontece uma vez por nota de voz (não por mensagem), e cachear introduziria a
 * pergunta "por quanto tempo o operador continua vendo o interruptor antigo depois de mexer nele" —
 * custo real, para economizar um índice único.
 */
export function createTranscriptionPolicyResolver(dependencies: ResolveTranscriptionPolicyDependencies) {
  return async function resolveTranscriptionPolicy(companyId: string): Promise<TranscriptionPolicy> {
    const settings = await dependencies.settingsRepository.get(companyId)

    return {
      // `??` e não `||`: `false` gravado é decisão explícita de desligar, e `||` a trocaria pelo
      // padrão do host — desligar no painel não faria nada num deploy com transcrição ligada.
      isEnabled: settings.transcriptionEnabled ?? dependencies.defaults.isEnabled,
      mode: normalizeMode(settings.transcriptionMode) ?? dependencies.defaults.mode,
    }
  }
}

export type TranscriptionPolicyResolver = ReturnType<typeof createTranscriptionPolicyResolver>

/**
 * A coluna é `varchar`, então o banco aceita qualquer string — um valor legado ou digitado à mão não
 * pode virar um modo que ninguém trata. Desconhecido cai no padrão do host.
 */
function normalizeMode(value: string | null): TranscriptionMode | undefined {
  if (value === TRANSCRIPTION_MODE.AUTO) return TRANSCRIPTION_MODE.AUTO
  if (value === TRANSCRIPTION_MODE.ON_DEMAND) return TRANSCRIPTION_MODE.ON_DEMAND
  return undefined
}
