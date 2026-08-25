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

import { Plus, Trash2, X } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { NotificationPreference, NotificationTemplate } from '@adatechnology/notification-contracts'

import {
  SORT_DIRECTIONS,
  TEMPLATE_COLUMNS,
  TEMPLATE_VIEWS,
  type TemplateSortField,
} from '../templateList.constant'
import { useNotificationContext } from '../NotificationProvider'
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences'
import { useCategoryPolicies } from '../hooks/useCategoryPolicies'
import { HtmlCodeField } from './HtmlCodeField'
import { MessageBodyField } from './MessageBodyField'
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

/** O laudo do validador, na forma mínima que a tela precisa desenhar. */
export type EmailHtmlReport = {
  readonly isValid: boolean
  readonly problems: readonly {
    readonly code: string
    readonly severity: string
    readonly message: string
  }[]
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
  /**
   * Confere o documento contra o que cliente de e-mail realmente faz (script, folha externa, imagem
   * em `data:`, tabela desbalanceada). Ausente, nenhum aviso aparece.
   */
  readonly validateEmailHtml?: (html: string) => EmailHtmlReport
  /**
   * Ações do produto no cabeçalho do EDITOR, ao lado de Fechar — recebe a chave do template aberto.
   *
   * É onde entra "Enviar teste": provar que a mensagem chega é operação do produto, não do pacote.
   * O pacote não sabe para quem mandar, por qual rota, nem o que fazer com o resultado; ele sabe
   * qual template está aberto, e é só isso que o slot precisa entregar.
   */
  readonly renderEditorActions?: (params: { readonly templateKey: string }) => ReactNode
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
  /** Rótulo humano de uma categoria (`auth` → "Acesso"). Ausente, mostra a própria chave. */
  readonly categoryLabelOf?: (category: string) => string
}

/**
 * O laudo do e-mail, so quando ha o que dizer.
 *
 * Documento limpo nao ganha selo verde: um aviso permanente de "tudo certo" e ruido que treina a
 * pessoa a nao ler a area — e ai o aviso de verdade passa batido junto.
 */
/**
 * O campo vira editor de codigo quando o texto TEM marcacao, e nao quando o canal e e-mail: a
 * maioria dos avisos e texto simples, e transformar o campo deles num editor com numeracao de linha
 * cobra complexidade de quem so queria escrever uma frase.
 */
function isHtmlBody(body: string): boolean {
  return /<\/?[a-zA-Z][\w:-]*(\s|>|\/)/.test(body)
}

function renderEmailProblems(report: EmailHtmlReport): ReactNode {
  if (report.problems.length === 0) return null

  return (
    <ul className="adn-settings__email-report">
      {report.problems.map((problem) => (
        <li key={problem.code} className={`adn-settings__email-problem adn-settings__email-problem--${problem.severity}`}>
          {problem.message}
        </li>
      ))}
    </ul>
  )
}

export function NotificationSettingsWorkspace({
  labels: labelsOverride,
  channels,
  categories,
  previewPayload,
  templateLabelOf,
  renderChannelFields,
  renderEditorActions,
  validateEmailHtml,
  renderHeader,
  renderHeaderActions,
  className,
  senderName,
  categoryLabelOf,
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

  /**
   * Três estados no cabeçalho (web.md §7): a seta neutra diz que a coluna ORDENA, e é por isso que
   * ela aparece antes de qualquer clique.
   */
  function sortMarkOf(field: TemplateSortField): string {
    if (editor.sort?.field !== field) return '↕'
    return editor.sort.direction === SORT_DIRECTIONS.ASC ? '↑' : '↓'
  }

  function ariaSortOf(field: TemplateSortField): 'ascending' | 'descending' | 'none' {
    if (editor.sort?.field !== field) return 'none'
    return editor.sort.direction === SORT_DIRECTIONS.ASC ? 'ascending' : 'descending'
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

      {/* Sem rascunho a coluna do editor nao existe: a lista fica com a largura inteira. Reservar
          2/3 da tela para "escolha uma mensagem" e cobrar espaco por uma instrucao. */}
      {tab === 'messages' && (
      <div className={editor.draft ? 'adn-settings__templates' : 'adn-settings__templates adn-settings__templates--browsing'}>
        <section className="adn-settings__template-list">
          <header className="adn-settings__list-header">
            {/* Titulo e acao na MESMA linha; a explicacao desce inteira embaixo. Com os tres lado a
                lado numa coluna de 320px a explicacao quebrava em tres linhas e empurrava o botao. */}
            <div className="adn-settings__list-header-row">
              <h2 className="adn-settings__section-title">{label('settings.templatesTitle')}</h2>
              <div className="adn-settings__list-header-actions">
                {/* Duas leituras da mesma colecao: a tabela compara, a lista reconhece o texto. */}
                <div className="adn-settings__view-switch" role="group" aria-label={label('settings.viewLabel')}>
                  {[TEMPLATE_VIEWS.TABLE, TEMPLATE_VIEWS.LIST].map((view) => (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={editor.view === view}
                      className={
                        editor.view === view
                          ? 'adn-settings__view adn-settings__view--on'
                          : 'adn-settings__view'
                      }
                      onClick={() => editor.setView(view)}
                    >
                      {label(`settings.view.${view}`)}
                    </button>
                  ))}
                </div>
                <button type="button" className="adn-settings__new" onClick={editor.startNew}>
                  {/* Decorativo: o rotulo ao lado ja diz a acao, e o leitor de tela nao repete. */}
                  <Plus className="adn-settings__button-icon" aria-hidden="true" />
                  {label('settings.newTemplate')}
                </button>
              </div>
            </div>
          </header>

          {/* Busca sobre chave E texto: quem procura costuma lembrar do que a mensagem diz, não
              da chave técnica. */}
          <div className="adn-settings__list-filters">
            <label className="adn-settings__search">
              <span className="adn-settings__field-label adn-settings__visually-hidden">
                {label('settings.searchLabel')}
              </span>
              <input
                type="search"
                value={editor.search}
                placeholder={label('settings.searchPlaceholder')}
                onChange={(event) => editor.setSearch(event.target.value)}
              />
            </label>

            {editor.categories.length > 1 && (
              <div className="adn-settings__filter-row">
                {editor.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={editor.categoryFilter.includes(category)}
                    className={
                      editor.categoryFilter.includes(category)
                        ? 'adn-settings__filter adn-settings__filter--on'
                        : 'adn-settings__filter'
                    }
                    onClick={() => editor.toggleCategoryFilter(category)}
                  >
                    {categoryLabelOf?.(category) ?? category}
                  </button>
                ))}
              </div>
            )}

            <div className="adn-settings__filter-row">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  aria-pressed={editor.channelFilter.includes(channel.id)}
                  className={
                    editor.channelFilter.includes(channel.id)
                      ? 'adn-settings__filter adn-settings__filter--on'
                      : 'adn-settings__filter'
                  }
                  onClick={() => editor.toggleChannelFilter(channel.id)}
                >
                  {channel.label}
                </button>
              ))}
            </div>

            {/* Só aparece quando há o que limpar (web.md §7). */}
            {editor.hasFilters && (
              <button type="button" className="adn-settings__clear" onClick={editor.clearFilters}>
                {label('settings.clearFilters')}
              </button>
            )}
          </div>

          {editor.isLoading && <p className="adn-settings__hint">{label('list.loading')}</p>}

          {/* "Nada cadastrado" e "nada encontrado" são estados diferentes: o primeiro pede criar,
              o segundo pede afrouxar o filtro. */}
          {!editor.isLoading && editor.totalCount === 0 && (
            <p className="adn-settings__hint">{label('settings.templatesEmpty')}</p>
          )}
          {!editor.isLoading && editor.totalCount > 0 && editor.templates.length === 0 && (
            <p className="adn-settings__hint">{label('settings.noResults')}</p>
          )}

          {editor.view === TEMPLATE_VIEWS.TABLE && editor.templates.length > 0 && (
            /* `overflow-x` no contêiner: a página nunca rola na horizontal (web.md §10). */
            <div className="adn-settings__table-scroll">
              <table className="adn-settings__table">
                <thead>
                  <tr>
                    {TEMPLATE_COLUMNS.map(({ labelKey, field, headerHidden }) => (
                      <th key={labelKey} scope="col" aria-sort={field ? ariaSortOf(field) : undefined}>
                        {field ? (
                          <button type="button" onClick={() => editor.toggleSort(field)}>
                            {label(labelKey)}
                            <span aria-hidden="true" className="adn-settings__sort-mark">
                              {sortMarkOf(field)}
                            </span>
                          </button>
                        ) : (
                          <span className={headerHidden ? 'adn-settings__visually-hidden' : undefined}>
                            {label(labelKey)}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editor.templates.map((template) => (
                    /* A linha inteira abre o template: na tabela so a celula da chave era clicavel,
                       e o alvo real de quem varre a lista e a linha. O botao da chave continua
                       existindo — e ele que recebe o foco pelo teclado. */
                    <tr
                      key={template.id}
                      onClick={() => editor.select(template)}
                      className={
                        editor.selected?.id === template.id
                          ? 'adn-settings__table-row adn-settings__table-row--active'
                          : 'adn-settings__table-row'
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="adn-settings__table-key"
                          onClick={() => editor.select(template)}
                        >
                          {templateLabelOf?.(template) ?? template.key}
                        </button>
                      </td>
                      <td className="adn-settings__table-body">{template.body}</td>
                      <td>
                        <span className={`adn-settings__badge adn-settings__badge--${template.channel}`}>
                          {label(`channel.${template.channel}`)}
                        </span>
                      </td>
                      <td className="adn-settings__version">
                        {label('settings.version')}
                        {template.version}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="adn-settings__remove"
                          aria-label={`${label('settings.remove')} ${template.key}`}
                          disabled={editor.isDeactivating}
                          /* Sem parar a propagacao, remover tambem abriria o template no editor. */
                          onClick={(event) => {
                            event.stopPropagation()
                            editor.deactivate(template.id)
                          }}
                        >
                          <Trash2 className="adn-settings__button-icon" aria-hidden="true" />
                          {label('settings.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editor.view === TEMPLATE_VIEWS.LIST &&
            editor.groups.map((group) => (
            <div key={group.category} className="adn-settings__group">
              <p className="adn-settings__group-title">
                {categoryLabelOf?.(group.category) ?? group.category}
                <span className="adn-settings__group-count">{group.templates.length}</span>
              </p>
              <ul>
                {group.templates.map((template) => (
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
                      <Trash2 className="adn-settings__button-icon" aria-hidden="true" />
                      {label('settings.remove')}
                    </button>
                  </li>
                ))}
              </ul>
              </div>
            ))}
        </section>

        {editor.draft && (
        <section className="adn-settings__editor">
          {(
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
                <div className="adn-settings__editor-actions">
                  {/* Antes do Fechar: a ação do produto é o que a pessoa procura ali; Fechar é saída. */}
                  {editor.selected && renderEditorActions?.({ templateKey: editor.selected.key })}
                  <button type="button" className="adn-settings__close" onClick={editor.clear}>
                    <X className="adn-settings__button-icon" aria-hidden="true" />
                    {label('settings.close')}
                  </button>
                </div>
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
                        {/* Editor de codigo so onde HTML significa alguma coisa. WhatsApp, SMS e push
                            recebem texto puro — realce ali sugeriria uma marcacao que o canal nao
                            entende, e a sugestao vira erro na entrega. */}
                        {channel.id === 'email' && isHtmlBody(content?.body ?? '') ? (
                          <HtmlCodeField
                            value={content?.body ?? ''}
                            onChange={(next) => editor.updateChannel(channel.id, { body: next })}
                            onSelect={(cursorIndex) => rememberCursor('body', cursorIndex)}
                            onFocus={() => setCursorChannel(channel.id)}
                            {...(validateEmailHtml
                              ? { problems: validateEmailHtml(content?.body ?? '').problems }
                              : {})}
                          />
                        ) : (
                          <MessageBodyField
                            value={content?.body ?? ''}
                            onChange={(next) => editor.updateChannel(channel.id, { body: next })}
                            onSelect={(cursorIndex) => rememberCursor('body', cursorIndex)}
                            onFocus={() => setCursorChannel(channel.id)}
                            labelOf={label}
                          />
                        )}
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
                                  {/* O HTML do preview e o QUE ESTA NO CAMPO, nao uma moldura que o
                                      painel enfia por fora: se a pessoa escreveu HTML, e o HTML
                                      dela que precisa aparecer. Corpo sem marcacao segue texto. */}
                                  <TemplatePreview
                                    channel={frame.channel}
                                    viewport={frame.viewport}
                                    rendered={frame.rendered}
                                    {...(frame.channel === 'email' && isHtmlBody(content?.body ?? '')
                                      ? { emailHtml: content?.body ?? '' }
                                      : {})}
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
                                      replyAll: label('preview.replyAll'),
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
        )}
      </div>
      )}
    </div>
  )
}
