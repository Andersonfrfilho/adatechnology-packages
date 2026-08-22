/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela de configuração COMPOSTA: canais por assunto e editor de mensagem com preview.
 *
 * Substitui as 221 linhas de página + 207 de hook que o primeiro consumidor escreveu. O que sobra
 * para o produto é dizer quais canais e assuntos existem — o resto é layout, e layout duplicado é
 * como as telas divergem.
 *
 * `channels` e `categories` são OBRIGATÓRIOS e vêm do produto porque o pacote não tem opinião sobre
 * eles: uma loja avisa status de pedido por WhatsApp, um banco avisa vencimento por e-mail, e o
 * `hint` de cada canal ("exige template aprovado", "exige aparelho registrado") é conhecimento do
 * produto sobre a própria operação.
 */

import type { ReactNode } from 'react'
import type { NotificationPreference, NotificationTemplate } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences'
import { useTemplateEditor } from '../hooks/useTemplateEditor'

export type NotificationChannelOption = {
  readonly id: string
  readonly label: string
  /** O custo do canal, em uma linha. É o que faz alguém decidir em vez de chutar. */
  readonly hint?: string
}

export type NotificationCategoryOption = {
  readonly id: string
  readonly label: string
  readonly hint?: string
}

export type NotificationSettingsWorkspaceProps = {
  readonly labels?: Partial<Record<string, string>>
  /** Os canais que ESTE produto oferece — o pacote despacha em cinco e não opina sobre quais usar. */
  readonly channels: readonly NotificationChannelOption[]
  /** Os assuntos que este produto dispara. */
  readonly categories: readonly NotificationCategoryOption[]
  /**
   * Valores de exemplo do preview, por assunto do template. Ausente, o preview mostra campo vazio —
   * que é honesto, mas menos útil para quem está escrevendo o texto.
   */
  readonly previewPayload?: Readonly<Record<string, unknown>>
  /** Traduz `order.status.preparing` no rótulo que o produto usa. Ausente, mostra a chave crua. */
  readonly templateLabelOf?: (template: NotificationTemplate) => string
  /**
   * Campo extra por canal — é onde entra o nome do template aprovado na Meta, que só o WhatsApp tem.
   * Ausente, nenhum campo extra aparece.
   */
  readonly renderChannelFields?: (params: {
    readonly channel: string
    readonly value: string
    readonly onChange: (value: string) => void
  }) => ReactNode
  /** Substitui o cabeçalho padrão — a página que já tem título próprio evita o segundo `<h1>`. */
  readonly renderHeader?: () => ReactNode
  /** Ações do produto no cabeçalho. */
  readonly renderHeaderActions?: () => ReactNode
  readonly className?: string
}

export function NotificationSettingsWorkspace({
  labels: labelsOverride,
  channels,
  categories,
  previewPayload,
  templateLabelOf,
  renderChannelFields,
  renderHeader,
  renderHeaderActions,
  className,
}: NotificationSettingsWorkspaceProps) {
  const { messages } = useNotificationContext()
  const label = (key: string): string => labelsOverride?.[key] ?? (messages as Record<string, string>)[key] ?? key

  const preferencesQuery = usePreferences()
  const updatePreferences = useUpdatePreferences()
  const editor = useTemplateEditor(previewPayload ? { previewPayload } : {})

  /**
   * Preferência ausente é o estado inicial normal — o módulo devolve só o que foi gravado. O default
   * é ligado: comportamento de fábrica é avisar, e um destinatário que não recebeu porque a linha não
   * existia é pior que um que recebeu demais.
   */
  function isEnabled(category: string, channel: string): boolean {
    const row = (preferencesQuery.data ?? []).find(
      (preference) => preference.category === category && preference.channel === channel,
    )
    return row?.enabled ?? true
  }

  function toggle(category: string, channel: string): void {
    // Conjunto inteiro: a rota é `PUT` em lote, e enviar só o que mudou apagaria o resto.
    const next: NotificationPreference[] = categories.flatMap((eachCategory) =>
      channels.map((eachChannel) => ({
        category: eachCategory.id,
        channel: eachChannel.id as NotificationPreference['channel'],
        enabled:
          eachCategory.id === category && eachChannel.id === channel
            ? !isEnabled(category, channel)
            : isEnabled(eachCategory.id, eachChannel.id),
      })),
    )
    updatePreferences.mutate(next)
  }

  return (
    <div className={`adn-settings ${className ?? ''}`}>
      {renderHeader ? (
        renderHeader()
      ) : (
        <header className="adn-settings__header">
          <div>
            <h1 className="adn-settings__title">{label('settings.title')}</h1>
            <p className="adn-settings__description">{label('settings.description')}</p>
          </div>
          {renderHeaderActions?.()}
        </header>
      )}

      <section className="adn-settings__channels">
        <h2 className="adn-settings__section-title">{label('settings.channelsTitle')}</h2>
        <p className="adn-settings__hint">{label('settings.channelsHint')}</p>

        {categories.map((category) => (
          <div key={category.id} className="adn-settings__category">
            <p className="adn-settings__category-label">{category.label}</p>
            {category.hint && <p className="adn-settings__hint">{category.hint}</p>}

            <div className="adn-settings__channel-grid">
              {channels.map((channel) => (
                <label key={channel.id} className="adn-settings__channel">
                  <input
                    type="checkbox"
                    checked={isEnabled(category.id, channel.id)}
                    disabled={updatePreferences.isPending}
                    onChange={() => toggle(category.id, channel.id)}
                  />
                  <span>
                    <span className="adn-settings__channel-label">{channel.label}</span>
                    {channel.hint && <span className="adn-settings__hint">{channel.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="adn-settings__templates">
        <section className="adn-settings__template-list">
          <header>
            <h2 className="adn-settings__section-title">{label('settings.templatesTitle')}</h2>
            <p className="adn-settings__hint">{label('settings.templatesHint')}</p>
          </header>

          {editor.isLoading && <p className="adn-settings__hint">{label('list.loading')}</p>}
          {!editor.isLoading && editor.templates.length === 0 && (
            <p className="adn-settings__hint">{label('settings.templatesEmpty')}</p>
          )}

          <ul>
            {editor.templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => editor.select(template)}
                  className={editor.selected?.id === template.id ? 'adn-settings__row--active' : undefined}
                >
                  <span className="adn-settings__row-main">
                    <span className="adn-settings__row-title">{templateLabelOf?.(template) ?? template.key}</span>
                    <span className="adn-settings__row-body">{template.body}</span>
                  </span>
                  <span className={`adn-settings__badge adn-settings__badge--${template.channel}`}>
                    {label(`channel.${template.channel}`)}
                  </span>
                  <span className="adn-settings__version">
                    {label('settings.version')}
                    {template.version}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="adn-settings__editor">
          {!editor.draft && <p className="adn-settings__hint">{label('settings.pickTemplate')}</p>}

          {editor.draft && (
            <>
              <header className="adn-settings__editor-header">
                <div>
                  <h2 className="adn-settings__section-title">
                    {editor.selected ? (templateLabelOf?.(editor.selected) ?? editor.selected.key) : ''}
                  </h2>
                  <p className="adn-settings__hint">
                    {editor.draft.channel} · {editor.draft.locale} · {label('settings.version')}
                    {editor.selected?.version}
                  </p>
                </div>
                <button type="button" onClick={editor.clear}>
                  {label('settings.close')}
                </button>
              </header>

              <label className="adn-settings__field">
                <span className="adn-settings__field-label">{label('settings.subject')}</span>
                <span className="adn-settings__hint">{label('settings.subjectHint')}</span>
                <input
                  value={editor.draft.subject}
                  onChange={(event) => editor.update({ subject: event.target.value })}
                />
              </label>

              <label className="adn-settings__field">
                <span className="adn-settings__field-label">{label('settings.body')}</span>
                <textarea
                  rows={4}
                  value={editor.draft.body}
                  onChange={(event) => editor.update({ body: event.target.value })}
                />
              </label>

              {/* Slot: campo que só um canal tem, e que o pacote não deve conhecer por nome. */}
              {renderChannelFields?.({
                channel: editor.draft.channel,
                value: editor.draft.whatsappTemplateName,
                onChange: (value) => editor.update({ whatsappTemplateName: value }),
              })}

              {editor.preview && (
                <div className="adn-settings__preview">
                  <p className="adn-settings__preview-title">{label('settings.previewTitle')}</p>
                  <p className="adn-settings__preview-subject">{editor.preview.title}</p>
                  <p className="adn-settings__preview-body">{editor.preview.body}</p>
                </div>
              )}

              {editor.error && <p className="adn-settings__error">{editor.error}</p>}

              <div className="adn-settings__actions">
                <button type="button" onClick={editor.save} disabled={!editor.isDirty || editor.isSaving}>
                  {editor.isSaving ? label('settings.saving') : label('settings.save')}
                </button>
                {/* Diz por que está desabilitado, em vez de deixar o botão inerte sem explicação. */}
                {!editor.isDirty && <span className="adn-settings__hint">{label('settings.unchanged')}</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
