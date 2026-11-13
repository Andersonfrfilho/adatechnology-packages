import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { WhatsAppTemplatesSettings } from './WhatsAppTemplatesSettings'
import type { WhatsAppTemplatesSettingsProps } from './WhatsAppTemplatesSettings'

function render(overrides: Partial<WhatsAppTemplatesSettingsProps> = {}): string {
  return renderToStaticMarkup(
    <WhatsAppTemplatesSettings
      templates={[]}
      selectedTemplateName=""
      onSelectTemplate={() => {}}
      variables={[]}
      onVariablesChange={() => {}}
      onSave={() => {}}
      {...overrides}
    />,
  )
}

describe('WhatsAppTemplatesSettings', () => {
  it('renderiza os formulários extras de papel na aba de seleção', () => {
    const markup = render({ extraRoleForms: <div>MARCADOR_PAPEL_EXTRA</div> })

    expect(markup).toContain('MARCADOR_PAPEL_EXTRA')
  })

  it('sem extraRoleForms, o comportamento é idêntico ao de antes', () => {
    const markup = render()

    expect(markup).not.toContain('MARCADOR_PAPEL_EXTRA')
  })

  it('aceita previewCompanyName e variableExamples em create sem quebrar a tipagem', () => {
    const markup = render({
      create: {
        value: {
          name: '',
          category: 'UTILITY',
          language: 'pt_BR',
          headerType: 'NONE',
          headerText: '',
          bodyText: '',
          footerText: '',
        },
        onChange: () => {},
        onSubmit: () => {},
        previewCompanyName: 'Empresa Teste',
        variableExamples: ['João', '123'],
      },
    })

    expect(markup).toContain('Criar template')
  })

  it('sem create, a aba de criação não aparece', () => {
    const markup = render()

    expect(markup).not.toContain('Criar template')
  })
})
