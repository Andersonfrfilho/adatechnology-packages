import { eq } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import type { WhatsAppSettings } from '@adatechnology/meta-whatsapp-contracts'
import { settings, type SettingsRow } from '../schema/schema'

function toContractSettings(row: SettingsRow): WhatsAppSettings {
  return {
    templateName: row.templateName ?? '',
    templateLanguage: row.templateLanguage,
    templateVariables: row.templateVariables,
    welcomeMessage: row.welcomeMessage ?? '',
    farewellMessage: row.farewellMessage ?? '',
    // `?? null` e não `?? false`: nulo é "o painel não decidiu", e é o que faz valer o padrão do
    // host. Colapsar para `false` desligaria quem ligou por ambiente.
    transcriptionEnabled: row.transcriptionEnabled ?? null,
    transcriptionMode: row.transcriptionMode ?? null,
  }
}

const EMPTY_SETTINGS: WhatsAppSettings = {
  templateName: '',
  templateLanguage: 'pt_BR',
  templateVariables: [],
  welcomeMessage: '',
  farewellMessage: '',
  transcriptionEnabled: null,
  transcriptionMode: null,
}

// T5.5 — configuração de WhatsApp por empresa.
export class SettingsRepository {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  // Empresa sem linha de configuração é o estado normal logo após instalar o módulo — devolve
  // os defaults em vez de undefined, para o chamador não precisar tratar "ainda não configurado"
  // como caso especial em todo lugar.
  async get(companyId: string): Promise<WhatsAppSettings> {
    const [row] = await this.db.select().from(settings).where(eq(settings.companyId, companyId)).limit(1)
    return row ? toContractSettings(row) : EMPTY_SETTINGS
  }

  async save(companyId: string, update: Partial<WhatsAppSettings>): Promise<WhatsAppSettings> {
    const current = await this.get(companyId)
    const merged = { ...current, ...update }

    const [row] = await this.db
      .insert(settings)
      .values({
        companyId,
        templateName: merged.templateName || null,
        templateLanguage: merged.templateLanguage,
        templateVariables: merged.templateVariables,
        welcomeMessage: merged.welcomeMessage || null,
        farewellMessage: merged.farewellMessage || null,
        // Sem `|| null`: `false` aqui é decisão explícita do painel ("desligado para esta empresa"),
        // e colapsá-lo para nulo faria a empresa voltar a herdar o padrão do host — exatamente o
        // oposto do que o operador acabou de pedir.
        transcriptionEnabled: merged.transcriptionEnabled,
        transcriptionMode: merged.transcriptionMode,
      })
      .onConflictDoUpdate({
        target: settings.companyId,
        set: {
          templateName: merged.templateName || null,
          templateLanguage: merged.templateLanguage,
          templateVariables: merged.templateVariables,
          welcomeMessage: merged.welcomeMessage || null,
          farewellMessage: merged.farewellMessage || null,
          transcriptionEnabled: merged.transcriptionEnabled,
          transcriptionMode: merged.transcriptionMode,
          updatedAt: new Date(),
        },
      })
      .returning()

    return toContractSettings(row!)
  }

  // Resolve {{1}}, {{2}}... a partir do mapa configurado + o contexto da conversa. Ex.: se
  // templateVariables = ['{clientName}', '{city}'], devolve [nome, cidade] na ordem posicional
  // que a Graph API espera nos bodyParameters.
  async resolveTemplateVariables(companyId: string, context: Record<string, unknown>): Promise<string[]> {
    const { templateVariables } = await this.get(companyId)
    return templateVariables.map((token) => {
      const key = token.replace(/^\{|\}$/g, '')
      const value = context[key]
      return value === undefined || value === null ? '' : String(value)
    })
  }
}
