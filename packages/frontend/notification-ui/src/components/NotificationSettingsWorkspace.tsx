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

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { NotificationPreference, NotificationTemplate } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences'
import { useCategoryPolicies } from '../hooks/useCategoryPolicies'
import { useTemplateEditor } from '../hooks/useTemplateEditor'
import type { TemplateDraftField } from '../hooks/useTemplateEditor'

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
  const editor = useTemplateEditor({
    ...(previewPayload ? { previewPayload } : {}),
    ...(channels[0] ? { defaultChannel: channels[0].id } : {}),
  })

  /**
   * Onde inserir a variável. Guardado no `onSelect` dos campos porque o hook não pode conhecer o
   * DOM — e sem isso o clique na variável só saberia concatenar no fim, que é justamente o lugar
   * errado quando se está corrigindo o meio de uma frase.
   */
  const [cursor, setCursor] = useState<{ field: TemplateDraftField; cursorIndex: number }>({
    field: 'body',
    cursorIndex: 0,
  })

  function rememberCursor(field: TemplateDraftField, cursorIndex: number | null): void {
    setCursor({ field, cursorIndex: cursorIndex ?? 0 })
  }

  const policies = useCategoryPolicies()
  const [tab, setTab] = useState<'messages' | 'routing'>('messages')

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

      <div className="adn-settings__tabs" role="tablist">
        {(['messages', 'routing'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'adn-settings__tab adn-settings__tab--active' : 'adn-settings__tab'}
            onClick={() => setTab(id)}
          >
            {label(`settings.tab.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'routing' && (
        <section className="adn-settings__policies">
          <h2 className="adn-settings__section-title">{label('settings.policiesTitle')}</h2>
          <p className="adn-settings__hint">{label('settings.policiesHint')}</p>

          {categories.map((category) => (
            <div key={category.id} className="adn-settings__category">
              <p className="adn-settings__category-title">{category.label}</p>
              <div className="adn-settings__category-channels">
                {channels.map((channel) => (
                  <label key={channel.id} className="adn-settings__toggle">
                    <input
                      type="checkbox"
                      checked={policies.isAllowed({ category: category.id, channel: channel.id })}
                      onChange={() => policies.toggle({ category: category.id, channel: channel.id })}
                    />
                    <span className="adn-settings__channel-label">{channel.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {policies.error && <p className="adn-settings__error">{policies.error}</p>}

          <div className="adn-settings__actions">
            <button type="button" onClick={policies.save} disabled={!policies.isDirty || policies.isSaving}>
              {policies.isSaving ? label('settings.saving') : label('settings.savePolicies')}
            </button>
            {policies.isDirty && (
              <button type="button" onClick={policies.reset}>
                {label('settings.discard')}
              </button>
            )}
          </div>
        </section>
      )}

      {tab === 'routing' && (
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
      )}

      {tab === 'messages' && (
      <div className="adn-settings__templates">
        <section className="adn-settings__template-list">
          <header className="adn-settings__list-header">
            <div>
              <h2 className="adn-settings__section-title">{label('settings.templatesTitle')}</h2>
              <p className="adn-settings__hint">{label('settings.templatesHint')}</p>
            </div>
            <button type="button" className="adn-settings__new" onClick={editor.startNew}>
              {label('settings.newTemplate')}
            </button>
          </header>

          {editor.isLoading && <p className="adn-settings__hint">{label('list.loading')}</p>}
          {!editor.isLoading && editor.templates.length === 0 && (
            <p className="adn-settings__hint">{label('settings.templatesEmpty')}</p>
          )}

          <ul>
            {editor.templates.map((template) => (
              <li key={template.id} className="adn-settings__row">
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
                <button
                  type="button"
                  className="adn-settings__remove"
                  aria-label={`${label('settings.remove')} ${template.key}`}
                  disabled={editor.isDeactivating}
                  onClick={() => editor.deactivate(template.id)}
                >
                  {label('settings.remove')}
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

              {!editor.isIdentityLocked && (
                <div className="adn-settings__identity">
                  <label className="adn-settings__field">
                    <span className="adn-settings__field-label">{label('settings.key')}</span>
                    <span className="adn-settings__hint">{label('settings.keyHint')}</span>
                    <input value={editor.draft.key} onChange={(event) => editor.update({ key: event.target.value })} />
                  </label>

                  <label className="adn-settings__field">
                    <span className="adn-settings__field-label">{label('settings.channel')}</span>
                    <select
                      value={editor.draft.channel}
                      onChange={(event) => editor.update({ channel: event.target.value })}
                    >
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="adn-settings__field">
                    <span className="adn-settings__field-label">{label('settings.locale')}</span>
                    <input
                      value={editor.draft.locale}
                      onChange={(event) => editor.update({ locale: event.target.value })}
                    />
                  </label>
                </div>
              )}

              {editor.variables.length > 0 && (
                <div className="adn-settings__variables">
                  <p className="adn-settings__field-label">{label('settings.variablesTitle')}</p>
                  <p className="adn-settings__hint">{label('settings.variablesHint')}</p>
                  <ul>
                    {editor.variables.map((variable) => {
                      const used = editor.variableDiff.used.includes(variable.name)
                      const missing = editor.variableDiff.missingRequired.includes(variable.name)
                      return (
                        <li key={variable.name}>
                          <button
                            type="button"
                            className={[
                              'adn-settings__variable',
                              used ? 'adn-settings__variable--used' : '',
                              missing ? 'adn-settings__variable--missing' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => editor.insertVariable({ ...cursor, name: variable.name })}
                          >
                            <span className="adn-settings__variable-name">{`{{${variable.name}}}`}</span>
                            <span className="adn-settings__hint">{variable.example}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {editor.variableDiff.unknown.length > 0 && (
                <p className="adn-settings__error">
                  {label('settings.unknownVariables')} {editor.variableDiff.unknown.join(', ')}
                </p>
              )}

              <label className="adn-settings__field">
                <span className="adn-settings__field-label">{label('settings.subject')}</span>
                <span className="adn-settings__hint">{label('settings.subjectHint')}</span>
                <input
                  value={editor.draft.subject}
                  onChange={(event) => editor.update({ subject: event.target.value })}
                  onSelect={(event) => rememberCursor('subject', event.currentTarget.selectionStart)}
                />
              </label>

              <label className="adn-settings__field">
                <span className="adn-settings__field-label">{label('settings.body')}</span>
                <textarea
                  rows={4}
                  value={editor.draft.body}
                  onChange={(event) => editor.update({ body: event.target.value })}
                  onSelect={(event) => rememberCursor('body', event.currentTarget.selectionStart)}
                />
              </label>

              {/* Slot: campo que só um canal tem, e que o pacote não deve conhecer por nome. */}
              {renderChannelFields?.({
                channel: editor.draft.channel,
                value: editor.draft.whatsappTemplateName,
                onChange: (value) => editor.update({ whatsappTemplateName: value }),
              })}

              {editor.previews.length > 0 && (
                <div className="adn-settings__previews">
                  <p className="adn-settings__preview-title">{label('settings.previewTitle')}</p>
                  <div className="adn-settings__preview-frames">
                    {editor.previews.map((frame) => (
                      <figure key={frame.viewport} className="adn-settings__preview">
                        <figcaption className="adn-settings__hint">
                          {label(`settings.viewport.${frame.viewport}`)} · {frame.width}px
                        </figcaption>
                        {/* Largura fixa é o ponto: é ela que revela o corte que só acontece num
                            dos dois. O texto sai como nó de texto — nunca innerHTML, mesmo já
                            escapado pelo renderer. */}
                        <div
                          className="adn-settings__preview-frame"
                          /* A largura e a REAL do canal; o CSS reduz para caber e compensa a sobra. */
                          style={{ width: frame.width, '--adn-preview-width': `${frame.width}px` } as CSSProperties}
                        >
                          <p className="adn-settings__preview-subject">{frame.rendered.title}</p>
                          <p className="adn-settings__preview-body">{frame.rendered.body}</p>
                        </div>
                        {frame.rendered.constraints
                          .filter((constraint) => constraint.exceeded)
                          .map((constraint) => (
                            <p key={constraint.field} className="adn-settings__preview-warning">
                              {label(`settings.constraint.${constraint.field}`)} {constraint.actual}/{constraint.limit}
                            </p>
                          ))}
                      </figure>
                    ))}
                  </div>
                </div>
              )}

              {editor.error && <p className="adn-settings__error">{editor.error}</p>}

              <div className="adn-settings__actions">
                <button type="button" onClick={editor.save} disabled={!editor.isDirty || !editor.canSave || editor.isSaving}>
                  {editor.isSaving ? label('settings.saving') : label('settings.save')}
                </button>
                {/* Diz por que está desabilitado, em vez de deixar o botão inerte sem explicação. */}
                {!editor.isDirty && <span className="adn-settings__hint">{label('settings.unchanged')}</span>}
              </div>
            </>
          )}
        </section>
      </div>
      )}
    </div>
  )
}
