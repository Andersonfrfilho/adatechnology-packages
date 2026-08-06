/**
 * Cabeçalho do painel de conversa: quem é o cliente, quem está conduzindo (bot ou humano) e as
 * ações de atendimento.
 *
 * Presentacional por decisão de arquitetura: `ConversationsApi` não tem takeover/release, e não é
 * papel do pacote saber a rota de cada host. Quem passa os handlers é o produto.
 */

import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Bot, Download, FileText, Headset, MoreVertical, UserRound, X } from 'lucide-react'

import type { ConversationSummary } from './providers/types'
import { capabilitiesOf, contactFlag, formatContactHandle } from './conversationChannel'
import { cn } from './lib/cn'
import { ICON_SIZE_ACTION, ICON_SIZE_INLINE } from './icon.constant'
import { useContainerWidth } from './hooks/useContainerWidth'
import { Avatar } from './Avatar'
import { ChannelIcon } from './ChannelIcon'

/**
 * Larguras do próprio cabeçalho (em px) que decidem o quanto ele recolhe. São da faixa, não da
 * janela: com a prévia do simulador aberta a coluna fica com metade da tela, e pelo breakpoint da
 * janela o cabeçalho continuava desenhando tudo — sobrava uma letra do nome do cliente.
 *
 * Abaixo da primeira, os utilitários (ícones de consulta) viram itens do menu ⋮ e o telefone volta a
 * caber; abaixo da segunda, até as ações escritas entram no menu, porque nem elas cabem sem comer o
 * nome. Quem identifica a conversa é o nome — ele é o último a ceder espaço.
 */
const HEADER_UTILITIES_MIN_WIDTH = 720
const HEADER_ACTIONS_MIN_WIDTH = 600

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
  // Sem emoji no rótulo: quem desenha o modo é o ícone ao lado, e o emoji embutido no texto voltava
  // a aparecer no tooltip e no leitor de tela como um caractere sem nome.
  botMode: 'atendimento automático',
  humanMode: 'atendimento humano',
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

/**
 * Utilitário extra que o host pendura no cabeçalho — ícone no desktop, item de menu no celular,
 * como os nativos. Entra por aqui, e não por um slot de ReactNode, porque é isso que preserva o
 * comportamento responsivo: um nó solto viraria um quarto ícone em 375px, sem área de toque.
 */
export interface ConversationHeaderUtility {
  key: string
  /** Ícone da biblioteca (lucide), no tamanho dos utilitários nativos: `<Play size={16} />`. */
  icon: ReactNode
  label: string
  run: () => void
  active?: boolean
}

/** Utilitário já resolvido para desenho: o `active` opcional do contrato vira estado explícito. */
type ResolvedUtility = ConversationHeaderUtility & { active: boolean }

/** Ação de atendimento pronta para virar botão na faixa ou item do menu ⋮. */
type HeaderAction = {
  key: string
  icon: ReactNode
  label: string
  hint: string
  run: () => void
  className: string
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
  /** Ações do produto que não existem no contrato do pacote (ex.: ferramentas de dev). */
  extraUtilities?: readonly ConversationHeaderUtility[]
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
  extraUtilities,
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
  const headerRef = useRef<HTMLElement>(null)
  const headerWidth = useContainerWidth(headerRef)

  // Sem medida ainda (SSR, primeiro render) o cabeçalho nasce completo: é o layout correto na maior
  // parte dos casos, e recolher depois não tira nada do lugar de quem já estava lendo.
  const showsUtilitiesInline = headerWidth === undefined || headerWidth >= HEADER_UTILITIES_MIN_WIDTH
  const showsActionsInline = headerWidth === undefined || headerWidth >= HEADER_ACTIONS_MIN_WIDTH

  // Utilitários: ícone no desktop, item de menu no celular. Três ícones lado a lado em 375px não
  // caberiam com área de toque decente, e nenhum deles é a ação principal do atendimento.
  const utilityCandidates: readonly (ResolvedUtility | undefined)[] = [
    onOpenDocuments
      ? {
          key: 'documents',
          icon: <FileText size={ICON_SIZE_ACTION} />,
          label: labels.documents,
          run: onOpenDocuments,
          active: documentsOpen,
        }
      : undefined,
    onDownload
      ? {
          key: 'download',
          icon: <Download size={ICON_SIZE_ACTION} />,
          label: labels.download,
          run: onDownload,
          active: false,
        }
      : undefined,
    ...(extraUtilities ?? []).map((utility) => ({ ...utility, active: utility.active ?? false })),
  ]
  const utilities = utilityCandidates.filter((utility): utility is ResolvedUtility => Boolean(utility))

  // Lista única de ações: alimenta os botões do desktop e o menu do celular, para as duas
  // superfícies nunca divergirem sobre o que está disponível.
  // `hint` existe separado do `label` porque o host pode traduzir o rótulo com prefixo ou contagem:
  // no tooltip isso vira ruído, e é o texto limpo que descreve a ação.
  const actionCandidates: readonly (HeaderAction | undefined)[] = [
    !isHuman && onTakeover
      ? {
          key: 'takeover',
          icon: <Headset size={ICON_SIZE_ACTION} />,
          label: labels.takeover,
          hint: labels.takeover,
          run: onTakeover,
          className: 'cv-header-action--primary',
        }
      : undefined,
    isHuman && onReturnToBot
      ? {
          key: 'release',
          icon: <Bot size={ICON_SIZE_ACTION} />,
          label: labels.returnToBot,
          hint: labels.returnToBot,
          run: onReturnToBot,
          className: '',
        }
      : undefined,
    isHuman && onFinish
      ? {
          key: 'finish',
          icon: <X size={ICON_SIZE_ACTION} />,
          label: labels.finish,
          hint: labels.finish,
          run: onFinish,
          className: 'cv-header-action--danger',
        }
      : undefined,
  ]
  const actions = actionCandidates.filter((action): action is HeaderAction => Boolean(action))

  // O menu recebe só o que não coube na faixa: utilitários primeiro, porque são consulta e não
  // alteram estado da conversa. Nada aparece nos dois lugares — item duplicado é o operador achando
  // que são duas coisas diferentes.
  const menuItems = [
    ...(showsUtilitiesInline
      ? []
      : utilities.map((utility) => ({
          key: utility.key,
          icon: utility.icon,
          label: utility.label,
          hint: utility.label,
          run: utility.run,
          className: '',
        }))),
    ...(showsActionsInline ? [] : actions),
  ]

  // `flex-nowrap` no cabeçalho: com wrap, o nome do cliente ocupava a largura toda em 375px e
  // empurrava as ações para uma segunda linha — e o menu, ancorado ao próprio botão, passava a abrir
  // fora da tela. O bloco de identificação encurta (truncate) em vez de empurrar.
  return (
    <header
      ref={headerRef}
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
          <button type="button" onClick={onBack} className="cv-back cv-touch" aria-label={labels.back} data-cv-tooltip={labels.back}>
            <ArrowLeft size={ICON_SIZE_ACTION} aria-hidden="true" />
          </button>
        ) : null}
        {/* Sem nome, o Avatar cai na silhueta — melhor que dois dígitos do telefone como iniciais. */}
        <Avatar name={conversation.clientName} size="md" />
        <div className="min-w-0">
          <p className={cn('truncate font-medium', classNames?.name)}>{conversation.clientName ?? displayHandle}</p>
          {/* Flex com `items-center`, não texto corrido: ícone de canal e emoji de modo têm altura
              maior que a fonte, e como elementos inline cada um assentava na própria baseline —
              telefone, canal e modo saíam em três alturas diferentes. O gap substitui as margens. */}
          <p className={cn('flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden text-xs text-gray-500', classNames?.meta)}>
            {/* Bandeira derivada do DDI e só quando o identificador é telefone. Estava fixa em 🇧🇷,
                o que rotulava qualquer contato como brasileiro. */}
            <span className="truncate">
              {flag ? `${flag} ` : ''}
              {displayHandle}
            </span>
            {/* Em faixa estreita sobra só o ícone do canal e o do modo: o rótulo escrito empurra o
                telefone para fora e não diz nada que o ícone já não diga. */}
            <span className="inline-flex flex-shrink-0 items-center gap-1">
              <ChannelIcon channel={conversation.channel} />
              {showsUtilitiesInline ? <span>{capabilities.label}</span> : null}
            </span>
            <span
              className="inline-flex flex-shrink-0 items-center gap-1"
              // Sem o rótulo escrito, o ícone sozinho não diria nada ao leitor de tela.
              {...(showsUtilitiesInline
                ? {}
                : { role: 'img', 'aria-label': isHuman ? labels.humanMode : labels.botMode, 'data-cv-tooltip': isHuman ? labels.humanMode : labels.botMode })}
            >
              {isHuman ? (
                <UserRound size={ICON_SIZE_INLINE} aria-hidden="true" />
              ) : (
                <Bot size={ICON_SIZE_INLINE} aria-hidden="true" />
              )}
              {showsUtilitiesInline ? <span>{isHuman ? labels.humanMode : labels.botMode}</span> : null}
            </span>
          </p>
        </div>
      </div>

      <div className={cn('flex shrink-0 items-center gap-2', classNames?.actions)}>
        {/* Faixa larga: utilitários como ícone e ações como botão, tudo visível de uma vez. */}
        <div className={cn('flex items-center gap-2', classNames?.desktopActions)}>
          {(showsUtilitiesInline ? utilities : []).map((utility) => (
            <button
              key={utility.key}
              type="button"
              onClick={utility.run}
              disabled={busy}
              aria-pressed={utility.active}
              data-cv-tooltip={utility.label}
              aria-label={utility.label}
              className={`cv-header-icon ${utility.active ? 'cv-header-icon--active' : ''}`}
            >
              {utility.icon}
            </button>
          ))}
          {(showsActionsInline ? actions : []).map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.run}
              disabled={busy}
              data-cv-tooltip={action.hint} aria-label={action.hint}
              className={`cv-header-action ${action.className}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>

        {/* Faixa estreita: um único ⋮ com o que não coube. Ícones de 30px lado a lado violavam o
            mínimo de 44px de área de toque e disputavam espaço com o nome do cliente. */}
        {menuItems.length > 0 ? (
          <div className={cn('cv-menu', classNames?.mobileMenu)}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={labels.moreActions}
              data-cv-tooltip={labels.moreActions}
              className="cv-header-icon cv-touch"
            >
              <MoreVertical size={ICON_SIZE_ACTION} aria-hidden="true" />
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
                    data-cv-tooltip={item.hint} aria-label={item.hint}
                    className={`cv-header-action cv-touch ${item.className}`}
                  >
                    {item.icon}
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
