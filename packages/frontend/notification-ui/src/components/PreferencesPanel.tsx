/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'
import { Save } from 'lucide-react'
import clsx from 'clsx'
import type { NotificationPreference } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences'

export type PreferencesPanelProps = {
  readonly className?: string
}

function channelLabelKey(channel: string): string {
  return `channel.${channel}`
}

export function PreferencesPanel({ className }: PreferencesPanelProps) {
  const { messages, theme } = useNotificationContext()
  const { data: saved = [], isPending } = usePreferences()
  const updatePreferences = useUpdatePreferences()

  // Rascunho local só existe entre abrir e salvar: `undefined` significa "ainda não mexeu", e é o
  // que faz o painel refletir o servidor sem sobrescrever edição em andamento a cada refetch.
  const [draft, setDraft] = useState<NotificationPreference[] | undefined>(undefined)
  const preferences = draft ?? saved

  function toggleChannel(target: NotificationPreference): void {
    setDraft(
      preferences.map((preference) =>
        preference.category === target.category && preference.channel === target.channel
          ? { ...preference, enabled: !preference.enabled }
          : preference,
      ),
    )
  }

  function handleSave(): void {
    updatePreferences.mutate(preferences, { onSuccess: () => setDraft(undefined) })
  }

  if (isPending) return <p className="adn-preferences__state">{messages['list.loading']}</p>

  return (
    <section className={clsx('adn-preferences', theme.rootClassName, className)}>
      <header className="adn-preferences__header">
        <h2 className="adn-preferences__title">{messages['preferences.title']}</h2>
        <p className="adn-preferences__description">{messages['preferences.description']}</p>
      </header>

      {preferences.length === 0 ? (
        <p className="adn-preferences__state">{messages['preferences.empty']}</p>
      ) : (
        <ul className="adn-preferences__items">
          {preferences.map((preference) => {
            const inputId = `adn-pref-${preference.category}-${preference.channel}`
            return (
              <li key={inputId} className="adn-preferences__item">
                {/* `label` associado por `htmlFor`: aumenta a área de toque e é o que faz o
                    leitor de tela anunciar canal e estado juntos. */}
                <label className="adn-preferences__label" htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="checkbox"
                    className="adn-preferences__checkbox"
                    checked={preference.enabled}
                    onChange={() => toggleChannel(preference)}
                  />
                  <span className="adn-preferences__category">{preference.category}</span>
                  <span className="adn-preferences__channel">
                    {messages[channelLabelKey(preference.channel) as keyof typeof messages] ?? preference.channel}
                  </span>
                </label>

                {preference.quietHoursStart && preference.quietHoursEnd ? (
                  <span className="adn-preferences__quiet-hours">
                    {messages['preferences.quietHours']} {preference.quietHoursStart}{' '}
                    {messages['preferences.quietHoursTo']} {preference.quietHoursEnd}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <footer className="adn-preferences__footer">
        {/* Ação primária de formulário com convenção clara → ícone (regra de ícones, web.md §9). */}
        <button
          type="button"
          className="adn-preferences__save"
          onClick={handleSave}
          disabled={updatePreferences.isPending || draft === undefined}
        >
          <Save className="adn-preferences__save-icon" aria-hidden="true" />
          {messages['preferences.save']}
        </button>

        {updatePreferences.isSuccess && draft === undefined ? (
          <span className="adn-preferences__feedback" role="status">
            {messages['preferences.saved']}
          </span>
        ) : null}
        {updatePreferences.isError ? (
          <span className="adn-preferences__feedback adn-preferences__feedback--error" role="alert">
            {messages['preferences.error']}
          </span>
        ) : null}
      </footer>
    </section>
  )
}
