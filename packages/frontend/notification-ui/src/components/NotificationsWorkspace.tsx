/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A tela de notificações COMPOSTA, no molde do `ConversationsWorkspace`.
 *
 * O pacote exportava só as peças (`NotificationList`, `PreferencesPanel`), e o primeiro consumidor
 * remontou o grid à mão — 56 linhas na página da inbox e 221 na de configuração, contra 35 da página
 * de Documentos, que consome workspace. É exatamente o que a regra de módulos plugáveis (§4) rejeita:
 * cada produto remontando o layout é como as telas divergiram antes.
 *
 * Customização por contrato, nunca por fork:
 * - vocabulário → `labels`
 * - UI do produto → slots `renderHeaderActions`, `renderAboveList`, `renderEmpty`
 * - regra de negócio → callbacks (`onSelectNotification`)
 * - **capacidade por ausência**: sem `settingsHref` não aparece link de configuração, sem
 *   `showPreferences` não aparece a coluna. Nunca flag `hasX`.
 */

import type { ReactNode } from 'react'
import type { NotificationSummary } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { NotificationList } from './NotificationList'
import { PreferencesPanel } from './PreferencesPanel'

export type NotificationsWorkspaceProps = {
  /** Sobrescreve textos pontuais sem trocar o locale inteiro. */
  readonly labels?: Partial<Record<string, string>>
  /** Filtra a inbox por assunto. Ausente, mostra tudo. */
  readonly category?: string
  /**
   * Coluna de preferências ao lado da inbox.
   *
   * Ligada por padrão porque é o caso comum; um produto que gerencia preferência noutra tela passa
   * `false` e fica só com a inbox, em largura cheia.
   */
  readonly showPreferences?: boolean
  /** Ausente, o link de configuração não aparece — o produto pode não ter essa tela. */
  readonly settingsHref?: string | undefined
  /** Clique numa notificação. Ausente, a linha não é clicável. */
  readonly onSelectNotification?: (notification: NotificationSummary) => void
  /**
   * Substitui o cabeçalho padrão inteiro.
   *
   * O workspace desenha um `<h1>` porque ele é a tela; a página que já tem o título dela passava a
   * ter dois `<h1>` dizendo a mesma palavra, e para leitor de tela duas primeiras manchetes é o
   * mesmo que nenhuma. Ausente, o padrão continua desenhando — slot é substituição, não interruptor.
   */
  readonly renderHeader?: () => ReactNode
  /** Ações do produto no cabeçalho, ao lado do link de configuração. */
  readonly renderHeaderActions?: () => ReactNode
  /** Aviso ou filtro do produto, entre o cabeçalho e a lista. */
  readonly renderAboveList?: () => ReactNode
  /** Substitui o vazio padrão — útil quando o produto sabe explicar por que está vazio. */
  readonly renderEmpty?: () => ReactNode
  readonly className?: string
}

export function NotificationsWorkspace({
  labels: labelsOverride,
  category,
  showPreferences = true,
  settingsHref,
  onSelectNotification,
  renderHeader,
  renderHeaderActions,
  renderAboveList,
  renderEmpty,
  className,
}: NotificationsWorkspaceProps) {
  const { messages } = useNotificationContext()
  const label = (key: string): string => labelsOverride?.[key] ?? (messages as Record<string, string>)[key] ?? key

  return (
    <div className={`adn-workspace ${className ?? ''}`}>
      {renderHeader ? (
        renderHeader()
      ) : (
        <header className="adn-workspace__header">
          <div>
            <h1 className="adn-workspace__title">{label('workspace.title')}</h1>
            <p className="adn-workspace__description">{label('workspace.description')}</p>
          </div>

          <div className="adn-workspace__actions">
            {renderHeaderActions?.()}
            {/* Capacidade por ausência: sem href, sem link. */}
            {settingsHref && (
              <a href={settingsHref} className="adn-button adn-button--outline">
                {label('workspace.settingsLink')}
              </a>
            )}
          </div>
        </header>
      )}

      {renderAboveList?.()}

      <div className={showPreferences ? 'adn-workspace__grid' : 'adn-workspace__grid--single'}>
        <section className="adn-workspace__inbox">
          {/* O vazio desce para a lista, que é quem sabe se está vazia. Desenhado aqui, ele aparecia
              ao lado das notificações — "nada por aqui" embaixo do que estava ali. */}
          <NotificationList
            {...(category ? { category } : {})}
            {...(onSelectNotification ? { onSelect: onSelectNotification } : {})}
            {...(renderEmpty ? { renderEmpty } : {})}
          />
        </section>

        {showPreferences && (
          <aside className="adn-workspace__aside">
            <PreferencesPanel />
          </aside>
        )}
      </div>
    </div>
  )
}
