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

import { Fragment, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { NotificationPreference, NotificationTemplate } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences'
import { useCategoryPolicies } from '../hooks/useCategoryPolicies'
import { TemplatePreview } from './TemplatePreview'
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
  /**
   * Nome do produto no preview: e o remetente do e-mail e o app do push. O pacote nao sabe de
   * quem e a marca, e "Aviso" generico faria o preview mentir sobre o que a pessoa ve.
   */
  readonly senderName?: string
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
  senderName,
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

  /** Em qual canal o cursor estava: com um editor por canal, inserir variavel precisa saber onde. */
  const [cursorChannel, setCursorChannel] = useState<string | undefined>(undefined)
  /** Aba de canal aberta. `undefined` cai no primeiro marcado, para nunca abrir em branco. */
  const [activeChannel, setActiveChannel] = useState<string | undefined>(undefined)

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
            {/* Titulo e acao na MESMA linha; a explicacao desce inteira embaixo. Com os tres lado a
                lado numa coluna de 320px a explicacao quebrava em tres linhas e empurrava o botao. */}
            <div className="adn-settings__list-header-row">
              <h2 className="adn-settings__section-title">{label('settings.templatesTitle')}</h2>
              <button type="button" className="adn-settings__new" onClick={editor.startNew}>
                {label('settings.newTemplate')}
              </button>
            </div>
            <p className="adn-settings__hint">{label('settings.templatesHint')}</p>
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
                    {editor.draft.channels.join(' · ')} · {editor.draft.locale} · {label('settings.version')}
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

                  {/* Multipla escolha, e nao `select`: o mesmo aviso costuma sair por mais de um
                      canal, e escolher um de cada vez obrigaria a reescrever o texto. */}
                  <fieldset className="adn-settings__field adn-settings__field--channels">
                    <legend className="adn-settings__field-label">{label('settings.channel')}</legend>
                    <span className="adn-settings__hint">{label('settings.channelHint')}</span>
                    <div className="adn-settings__channel-picker">
                      {channels.map((channel) => (
                        <label key={channel.id} className="adn-settings__channel-chip">
                          <input
                            type="checkbox"
                            checked={editor.draft?.channels.includes(channel.id) ?? false}
                            onChange={() => {
                              editor.toggleChannel(channel.id)
                              /* Marcar um canal abre a aba dele: senao a pessoa marca e nada muda na tela. */
                              if (!editor.draft?.channels.includes(channel.id)) setActiveChannel(channel.id)
                            }}
                          />
                          <span>{channel.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

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
                            onClick={() =>
                              editor.insertVariable({
                                ...cursor,
                                name: variable.name,
                                channel: cursorChannel ?? editor.draft?.channels[0] ?? '',
                              })
                            }
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

              {/**
                * Um bloco por canal: texto, campos do canal e o preview dele, juntos.
                *
                * Os canais nao sao o mesmo recado em molduras diferentes — o WhatsApp ignora o
                * assunto, o SMS cobra por segmento e encurta. Com um editor so, escrever para o
                * pior canal e mandar isso a todos era a unica saida.
                */}
              {/**
                * Abas por canal, e nao blocos empilhados.
                *
                * Com tres canais marcados, empilhado obriga a rolar por tres aparelhos do e-mail
                * para chegar ao WhatsApp. A aba mantem o preview grande e o trabalho focado num
                * canal por vez — e a comparacao que importa (entre APARELHOS) continua lado a lado
                * dentro da aba.
                *
                * O ponto no rotulo e o que impede o efeito colateral: canal sem texto, ou com
                * variavel desconhecida, bloqueia o salvar — e escondido atras de uma aba fechada,
                * bloquearia sem explicar. */}
              <div className="adn-settings__channel-tabs" role="tablist">
                {channels
                  .filter((channel) => editor.draft?.channels.includes(channel.id))
                  .map((channel) => {
                    const vazio = (editor.draft?.byChannel[channel.id]?.body ?? '').length === 0
                    const ativo = (activeChannel ?? editor.draft?.channels[0]) === channel.id

                    return (
                      <button
                        key={channel.id}
                        type="button"
                        role="tab"
                        aria-selected={ativo}
                        className={ativo ? 'adn-settings__tab adn-settings__tab--active' : 'adn-settings__tab'}
                        onClick={() => setActiveChannel(channel.id)}
                      >
                        {channel.label}
                        {vazio && <span className="adn-settings__tab-dot" aria-hidden="true" />}
                      </button>
                    )
                  })}
              </div>

              {channels
                .filter((channel) => editor.draft?.channels.includes(channel.id))
                .filter((channel) => (activeChannel ?? editor.draft?.channels[0]) === channel.id)
                .map((channel) => {
                  const content = editor.draft?.byChannel[channel.id]
                  const frames = editor.previews.filter((frame) => frame.channel === channel.id)

                  return (
                    <section key={channel.id} className="adn-settings__channel-block">
                      <header className="adn-settings__channel-block-header">
                        <h3 className="adn-settings__preview-channel">{channel.label}</h3>
                        {channel.hint && <span className="adn-settings__hint">{channel.hint}</span>}
                      </header>

                      <label className="adn-settings__field">
                        <span className="adn-settings__field-label">{label('settings.subject')}</span>
                        <span className="adn-settings__hint">{label('settings.subjectHint')}</span>
                        <input
                          value={content?.subject ?? ''}
                          onChange={(event) => editor.updateChannel(channel.id, { subject: event.target.value })}
                          onSelect={(event) => rememberCursor('subject', event.currentTarget.selectionStart)}
                          onFocus={() => setCursorChannel(channel.id)}
                        />
                      </label>

                      <label className="adn-settings__field">
                        <span className="adn-settings__field-label">{label('settings.body')}</span>
                        <textarea
                          rows={5}
                          value={content?.body ?? ''}
                          onChange={(event) => editor.updateChannel(channel.id, { body: event.target.value })}
                          onSelect={(event) => rememberCursor('body', event.currentTarget.selectionStart)}
                          onFocus={() => setCursorChannel(channel.id)}
                        />
                      </label>

                      {/* Slot do host: campo que só um canal tem, e que o pacote não conhece por nome. */}
                      {renderChannelFields?.({
                        channel: channel.id,
                        value: content?.whatsappTemplateName ?? '',
                        onChange: (value) => editor.updateChannel(channel.id, { whatsappTemplateName: value }),
                      })}

                      {frames.length > 0 && (
                        <div className="adn-settings__previews">
                          <p className="adn-settings__preview-title">{label('settings.previewTitle')}</p>
                          <div className="adn-settings__preview-frames">
                            {frames.map((frame) => (
                              <figure key={`${frame.channel}:${frame.viewport}`} className="adn-settings__preview">
                                <figcaption className="adn-settings__hint">
                                  {label(`settings.viewport.${frame.viewport}`)} · {frame.width}px
                                </figcaption>
                                <div
                                  className="adn-settings__preview-frame"
                                  style={{ '--adn-preview-width': `${frame.width}px` } as CSSProperties}
                                >
                                  <TemplatePreview
                                    channel={frame.channel}
                                    viewport={frame.viewport}
                                    rendered={frame.rendered}
                                    labels={{
                                      to: label('preview.to'),
                                      now: label('preview.now'),
                                      mailbox: label('preview.mailbox'),
                                      time: label('preview.time'),
                                      address: label('preview.address'),
                                      counter: label('preview.counter'),
                                      folder: label('preview.folder'),
                                      senderAddress: label('preview.senderAddress'),
                                      unsubscribe: label('preview.unsubscribe'),
                                      online: label('preview.online'),
                                      today: label('preview.today'),
                                      compose: label('preview.compose'),
                                      reply: label('preview.reply'),
                                      forward: label('preview.forward'),
                                    }}
                                    {...(senderName ? { senderName } : {})}
                                  />
                                </div>
                                {frame.rendered.constraints
                                  .filter((constraint) => constraint.exceeded)
                                  .map((constraint) => (
                                    <p key={constraint.field} className="adn-settings__preview-warning">
                                      {label(`settings.constraint.${constraint.field}`)} {constraint.actual}/
                                      {constraint.limit}
                                    </p>
                                  ))}
                              </figure>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )
                })}

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
