import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { TranscriptionSettingsForm } from './TranscriptionSettingsForm'
import type { TranscriptionSettingsFormProps } from './TranscriptionSettingsForm'

/**
 * Extrai uma tag pelo atributo, em vez de casar regex com a ordem dos atributos: o React SSR emite
 * `checked=""` antes de `value=""`, então `/value="auto"[^>]*checked/` falha num componente correto.
 */
function findTag(markup: string, tagPattern: RegExp, contains: string): string | undefined {
  return (markup.match(tagPattern) ?? []).find((tag) => tag.includes(contains))
}

function render(overrides: Partial<TranscriptionSettingsFormProps> = {}): string {
  return renderToStaticMarkup(
    <TranscriptionSettingsForm
      enabled={false}
      onEnabledChange={() => {}}
      mode="onDemand"
      onModeChange={() => {}}
      onSave={() => {}}
      {...overrides}
    />,
  )
}

describe('TranscriptionSettingsForm', () => {
  it('esconde a escolha de modo enquanto estiver desligado', () => {
    const markup = render({ enabled: false })

    expect(markup).not.toContain('Quando transcrever')
  })

  it('mostra as duas opções de modo ao ligar', () => {
    const markup = render({ enabled: true })

    expect(markup).toContain('Quando transcrever')
    expect(markup).toContain('Quando o atendente pedir')
    expect(markup).toContain('Automaticamente')
  })

  it('marca o modo atual', () => {
    const markup = render({ enabled: true, mode: 'auto' })
    const radios = /<input type="radio"[^>]*>/g

    expect(findTag(markup, radios, 'value="auto"')).toContain('checked')
    expect(findTag(markup, radios, 'value="onDemand"')).not.toContain('checked')
  })

  /**
   * "O ambiente consegue" é diferente de "esta empresa quer". Sem o aviso, o lojista ligaria o
   * interruptor num ambiente sem engine, nada apareceria, e nada explicaria por quê.
   */
  it('avisa e bloqueia quando a capacidade não existe no servidor', () => {
    const markup = render({ isAvailable: false })

    expect(markup).toContain('não está disponível neste ambiente')
    expect(findTag(markup, /<input type="checkbox"[^>]*>/g, 'type="checkbox"')).toContain('disabled')
  })

  it('não avisa nada quando a capacidade existe', () => {
    const markup = render({ isAvailable: true })

    expect(markup).not.toContain('não está disponível neste ambiente')
  })

  it('aceita rótulos do host', () => {
    const markup = render({ labels: { sectionTitle: 'Áudio em texto' } })

    expect(markup).toContain('Áudio em texto')
    expect(markup).not.toContain('Transcrição de áudio')
  })

  it('desabilita o salvar enquanto salva', () => {
    const markup = render({ saving: true })

    expect(markup).toContain('Salvando...')
    expect(findTag(markup, /<button[^>]*>/g, 'type="submit"')).toContain('disabled')
  })
})
