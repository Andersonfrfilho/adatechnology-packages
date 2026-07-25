import { assertConfigField } from '../shared/assertConfigField'
import { buildGraphUrl, graphFetch } from '../shared/graphFetch'
import { WhatsAppRejectionError, WhatsAppTemplateDuplicateError } from '../errors/WhatsAppError'
import type {
  WhatsAppProviderConfig,
  CreateTemplateParams,
  CreateTemplateResult,
  WhatsAppTemplateSummary,
  WhatsAppTemplateDetail,
  TemplateComponent,
  DeleteTemplateParams,
} from '../types'

const VARIABLE_PATTERN = /\{\{(\d+)\}\}/g

export class WhatsAppTemplateProvider {
  constructor(private readonly config: WhatsAppProviderConfig) {}

  private get wabaId(): string {
    return assertConfigField(this.config.wabaId, 'wabaId')
  }

  private templatesUrl(): string {
    return buildGraphUrl(this.config.apiVersion, `${this.wabaId}/message_templates`, this.config.baseUrl)
  }

  async listTemplates(): Promise<readonly WhatsAppTemplateSummary[]> {
    const url = `${this.templatesUrl()}?fields=id,name,status,category,language,components&limit=100`
    const response = (await graphFetch({ url, accessToken: this.config.accessToken })) as {
      data: ReadonlyArray<{
        id: string
        name: string
        status: string
        category: string
        language: string
        components: readonly TemplateComponent[]
      }>
    }

    return response.data.map((template) => this.toSummary(template))
  }

  private toSummary(template: {
    id: string
    name: string
    status: string
    category: string
    language: string
    components: readonly TemplateComponent[]
  }): WhatsAppTemplateSummary {
    const body = template.components.find((component) => component.type === 'BODY')
    const variableCount = (body?.text?.match(VARIABLE_PATTERN) ?? []).length
    const shortId = template.id ? template.id.slice(-8) : template.name.slice(0, 8)
    const displayName = template.name.replace(/_/g, ' ')

    return {
      id: template.id,
      name: template.name,
      shortId,
      displayName,
      status: template.status,
      category: template.category,
      language: template.language,
      bodyText: body?.text ?? null,
      variableCount,
    }
  }

  async getTemplate(templateId: string): Promise<WhatsAppTemplateDetail> {
    const url = `${buildGraphUrl(this.config.apiVersion, templateId, this.config.baseUrl)}?fields=id,name,status,category,language,components`
    const template = (await graphFetch({ url, accessToken: this.config.accessToken })) as {
      id: string
      name: string
      status: string
      category: string
      language: string
      components: readonly TemplateComponent[]
    }

    return { ...this.toSummary(template), components: template.components }
  }

  async createTemplate(params: CreateTemplateParams): Promise<CreateTemplateResult> {
    const { name, category, language = 'pt_BR', headerType = 'NONE', headerText, bodyText, footerText } = params

    const components: Array<{ type: string; text?: string }> = []
    if (headerType === 'TEXT' && headerText) components.push({ type: 'HEADER', text: headerText })
    components.push({ type: 'BODY', text: bodyText })
    if (footerText) components.push({ type: 'FOOTER', text: footerText })

    let response: { id?: string; name?: string; status?: string }
    try {
      response = (await graphFetch({
        url: this.templatesUrl(),
        accessToken: this.config.accessToken,
        method: 'POST',
        jsonBody: { name, category, language, components },
        timeoutMs: 15_000,
      })) as { id?: string; name?: string; status?: string }
    } catch (error) {
      if (error instanceof WhatsAppRejectionError && error.providerMessage.toLowerCase().includes('duplicate')) {
        throw new WhatsAppTemplateDuplicateError(error.rawResponse)
      }
      throw error
    }

    return { id: response.id, shortId: response.id ? response.id.slice(-8) : '', status: response.status ?? 'PENDING' }
  }

  async deleteTemplate(params: DeleteTemplateParams): Promise<void> {
    const url = `${this.templatesUrl()}?name=${encodeURIComponent(params.name)}&hsm_id=${encodeURIComponent(params.id)}`
    await graphFetch({ url, accessToken: this.config.accessToken, method: 'DELETE' })
  }
}
