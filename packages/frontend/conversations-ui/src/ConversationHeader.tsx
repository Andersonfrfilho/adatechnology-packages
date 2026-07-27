/**
 * Cabeçalho do painel de conversa: quem é o cliente, quem está conduzindo (bot ou humano) e as
 * ações de atendimento.
 *
 * Presentacional por decisão de arquitetura: `ConversationsApi` não tem takeover/release, e não é
 * papel do pacote saber a rota de cada host. Quem passa os handlers é o produto.
 */

import { useState } from 'react'

import type { ConversationSummary } from './providers/types'
import { capabilitiesOf, contactFlag, formatContactHandle } from './conversationChannel'
import { cn } from './lib/cn'
import { Avatar } from './Avatar'
import { ChannelIcon } from './ChannelIcon'

export interface ConversationHeaderLabels {
  botMode: string
  humanMode: string
  returnToBot: string
  finish: string
  takeover: string
  download: string
  documents: string
  back: string
  moreActions: string
}

export const DEFAULT_CONVERSATION_HEADER_LABELS: ConversationHeaderLabels = {
  botMode: '🤖 atendimento automático',
  humanMode: '🧑‍💼 atendimento humano',
  returnToBot: 'Devolver ao bot',
  finish: 'Finalizar',
  takeover: 'Assumir atendimento',
  download: 'Baixar conversa',
  documents: 'Arquivos da conversa',
  back: 'Voltar para a lista',
  moreActions: 'Mais ações',
}

/**
 * Partes estilizáveis do cabeçalho. Cada chave recebe classes que o `cn` funde por cima da base, e
 * conflito de utilitário (padding, gap, borda) fica com o valor do produto.
 */
export interface ConversationHeaderClassNames {
  root: string
  identity: string
  name: string
  meta: string
  actions: string
  desktopActions: string
  mobileMenu: string
}

export interface ConversationHeaderProps {
  conversation: ConversationSummary
  busy?: boolean
  onTakeover?: () => void
  onReturnToBot?: () => void
  onFinish?: () => void
  onDownload?: () => void
  onOpenDocuments?: () => void
  documentsOpen?: boolean
  onBack?: () => void
  labels?: Partial<ConversationHeaderLabels>
  className?: string
  classNames?: Partial<ConversationHeaderClassNames>
}

export function ConversationHeader({
  conversation,
  busy = false,
  onTakeover,
  onReturnToBot,
  onFinish,
  onDownload,
  onOpenDocuments,
  documentsOpen = false,
  onBack,
  labels: labelsOverride,
  className,
  classNames,
}: ConversationHeaderProps) {
  const labels = { ...DEFAULT_CONVERSATION_HEADER_LABELS, ...labelsOverride }
  const isHuman = conversation.mode === 'human'
  const handle = conversation.contactId ?? conversation.whatsappNumber
  const displayHandle = formatContactHandle({ handle, channel: conversation.channel })
  const flag = contactFlag({ handle, channel: conversation.channel })
  const capabilities = capabilitiesOf(conversation.channel)
  const [menuOpen, setMenuOpen] = useState(false)

  // Utilitários: ícone no desktop, item de menu no celular. Três ícones lado a lado em 375px não
  // caberiam com área de toque decente, e nenhum deles é a ação principal do atendimento.
  const utilities = [
    onOpenDocuments
      ? { key: 'documents', icon: '📄', label: labels.documents, run: onOpenDocuments, active: documentsOpen }
      : undefined,
    onDownload ? { key: 'download', icon: '⬇️', label: labels.download, run: onDownload, active: false } : undefined,
  ].filter(
    (utility): utility is { key: string; icon: string; label: string; run: () => void; active: boolean } =>
      Boolean(utility),
  )

  // Lista única de ações: alimenta os botões do desktop e o menu do celular, para as duas
  // superfícies nunca divergirem sobre o que está disponível.
  const actions = [
    !isHuman && onTakeover
      ? { key: 'takeover', label: labels.takeover, run: onTakeover, className: 'cv-header-action--primary' }
      : undefined,
    isHuman && onReturnToBot ? { key: 'release', label: labels.returnToBot, run: onReturnToBot, className: '' } : undefined,
    isHuman && onFinish
      ? { key: 'finish', label: `✕ ${labels.finish}`, run: onFinish, className: 'cv-header-action--danger' }
      : undefined,
  ].filter((action): action is { key: string; label: string; run: () => void; className: string } => Boolean(action))

  // No celular utilitários e ações moram no mesmo menu: utilitários primeiro, porque são consulta e
  // não alteram estado da conversa.
  const menuItems = [
    ...utilities.map((utility) => ({
      key: utility.key,
      label: `${utility.icon} ${utility.label}`,
      run: utility.run,
      className: '',
    })),
    ...actions,
  ]

  // `flex-nowrap` no cabeçalho: com wrap, o nome do cliente ocupava a largura toda em 375px e
  // empurrava as ações para uma segunda linha — e o menu, ancorado ao próprio botão, passava a abrir
  // fora da tela. O bloco de identificação encurta (truncate) em vez de empurrar.
  return (
    <header
      className={cn(
        'flex flex-nowrap items-center justify-between gap-3 border-b px-4 py-3',
        classNames?.root,
        className,
      )}
    >
      <div className={cn('flex min-w-0 flex-1 items-center gap-3', classNames?.identity)}>
        {/* Voltar existe só em tela estreita, onde lista e conversa não cabem juntas: sem ele, abrir
            uma conversa no celular é um beco sem saída. A classe some acima de 1024px. */}
        {onBack ? (
          <button type="button" onClick={onBack} className="cv-back cv-touch" aria-label={labels.back} title={labels.back}>
            ←
          </button>
        ) : null}
        {/* Sem nome, o Avatar cai na silhueta — melhor que dois dígitos do telefone como iniciais. */}
        <Avatar name={conversation.clientName} size="md" />
        <div className="min-w-0">
          <p className={cn('truncate font-medium', classNames?.name)}>{conversation.clientName ?? displayHandle}</p>
          <p className={cn('truncate text-xs text-gray-500', classNames?.meta)}>
            {/* Bandeira derivada do DDI e só quando o identificador é telefone. Estava fixa em 🇧🇷,
                o que rotulava qualquer contato como brasileiro. */}
            {flag ? `${flag} ` : ''}
            {displayHandle}
            {/* Em tela estreita sobra o ícone do canal e o emoji do modo: o rótulo escrito empurra o
                telefone para fora e não diz nada que o ícone já não diga. */}
            <span className="ml-2 inline-flex items-center gap-1">
              <ChannelIcon channel={conversation.channel} />
              <span className="cv-only-wide">{capabilities.label}</span>
            </span>
            <span className="ml-2 cv-only-wide">{isHuman ? labels.humanMode : labels.botMode}</span>
            <span className="ml-1 cv-only-narrow" title={isHuman ? labels.humanMode : labels.botMode}>
              {isHuman ? '🧑‍💼' : '🤖'}
            </span>
          </p>
        </div>
      </div>

      <div className={cn('flex shrink-0 items-center gap-2', classNames?.actions)}>
        {/* Desktop: utilitários como ícone e ações como botão, tudo visível de uma vez. */}
        <div className={cn('hidden items-center gap-2 lg:flex', classNames?.desktopActions)}>
          {utilities.map((utility) => (
            <button
              key={utility.key}
              type="button"
              onClick={utility.run}
              disabled={busy}
              aria-pressed={utility.active}
              title={utility.label}
              aria-label={utility.label}
              className={`cv-header-icon ${utility.active ? 'cv-header-icon--active' : ''}`}
            >
              {utility.icon}
            </button>
          ))}
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.run}
              disabled={busy}
              className={`cv-header-action ${action.className}`}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Celular: um único ⋮ com tudo dentro. Três ícones de 30px lado a lado violavam o mínimo
            de 44px de área de toque e disputavam espaço com o nome do cliente. */}
        {menuItems.length > 0 ? (
          <div className={cn('cv-menu lg:hidden', classNames?.mobileMenu)}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={labels.moreActions}
              title={labels.moreActions}
              className="cv-header-icon cv-touch"
            >
              ⋮
            </button>

            {menuOpen ? (
              <div className="cv-menu-panel" role="menu">
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      item.run()
                    }}
                    disabled={busy}
                    className={`cv-header-action cv-touch ${item.className}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
