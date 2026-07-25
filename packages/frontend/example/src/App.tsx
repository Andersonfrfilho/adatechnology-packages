import { useState, useEffect } from 'react'
import {
  ConversationsProvider,
  MessageBubble,
  MessageComposer,
  ConversationListItem,
  Avatar,
  ToastProvider,
  useToast,
} from '@adatechnology/conversations-ui'
import type { ConversationSummary, MessagePayload } from '@adatechnology/conversations-ui'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search } from 'lucide-react'

// ——— Mock data ———

const NOW = new Date()

const MOCK_MESSAGES: MessagePayload[] = [
  { id: '1', type: 'text', content: 'Olá! Gostaria de saber sobre os planos disponíveis.', direction: 'inbound', sender: 'customer', timestamp: new Date(NOW.getTime() - 600000).toISOString(), isFirstInGroup: true, isLastInGroup: false },
  { id: '2', type: 'text', content: 'Olá! Temos os planos *Basic*, *Pro* e *Enterprise*. Qual te interessa?', direction: 'outbound', sender: 'agent', timestamp: new Date(NOW.getTime() - 300000).toISOString(), status: 'read', isFirstInGroup: true, isLastInGroup: false },
  { id: '3', type: 'text', content: 'O Pro parece ideal. Qual o valor?', direction: 'inbound', sender: 'customer', timestamp: new Date(NOW.getTime() - 240000).toISOString(), isFirstInGroup: false, isLastInGroup: false },
  { id: '4', type: 'text', content: 'O plano *Pro* sai por *R$ 99/mês* com suporte 24h e 5 usuários.', direction: 'outbound', sender: 'agent', timestamp: new Date(NOW.getTime() - 180000).toISOString(), status: 'read', isFirstInGroup: false, isLastInGroup: true },
  { id: '5', type: 'image', base64: 'https://picsum.photos/400/300', caption: 'Resumo do plano Pro', direction: 'outbound', sender: 'agent', timestamp: new Date(NOW.getTime() - 120000).toISOString(), status: 'delivered', isFirstInGroup: true, isLastInGroup: false },
  { id: '6', type: 'text', content: 'Perfeito! Vou fechar esse então. 👍', direction: 'inbound', sender: 'customer', timestamp: new Date(NOW.getTime() - 60000).toISOString(), isFirstInGroup: true, isLastInGroup: true },
]

const MOCK_CONVERSATIONS: ConversationSummary[] = [
  { id: '1', whatsappNumber: '5511999999999', clientName: 'Maria Silva', lastContent: 'Perfeito! Vou fechar esse então.', lastDirection: 'inbound', lastAt: new Date(NOW.getTime() - 60000).toISOString(), lastInboundAt: new Date(NOW.getTime() - 60000).toISOString(), mode: 'human', assignedUserId: '1', waitingHuman: false, unread: 0, currentState: 'negotiation' },
  { id: '2', whatsappNumber: '5511988888888', clientName: 'João Santos', lastContent: 'Me manda o contrato por favor', lastDirection: 'inbound', lastAt: new Date(NOW.getTime() - 1800000).toISOString(), lastInboundAt: new Date(NOW.getTime() - 1800000).toISOString(), mode: 'bot', assignedUserId: null, waitingHuman: true, unread: 3, currentState: 'awaiting_document' },
  { id: '3', whatsappNumber: '5511977777777', clientName: undefined, lastContent: 'Obrigado, resolvido!', lastDirection: 'inbound', lastAt: new Date(NOW.getTime() - 3600000).toISOString(), lastInboundAt: new Date(NOW.getTime() - 3600000).toISOString(), mode: 'bot', assignedUserId: null, waitingHuman: false, unread: 0, currentState: 'idle' },
  { id: '4', whatsappNumber: '5511966666666', clientName: 'Ana Costa', lastContent: 'Vou precisar de mais 2 dias', lastDirection: 'inbound', lastAt: new Date(NOW.getTime() - 90000000).toISOString(), lastInboundAt: new Date(NOW.getTime() - 90000000).toISOString(), mode: 'human', assignedUserId: '2', waitingHuman: false, unread: 0, currentState: 'follow_up' },
  { id: '5', whatsappNumber: '5511955555555', clientName: 'Pedro Alves', lastContent: 'Qual o prazo de entrega do documento?', lastDirection: 'outbound', lastAt: new Date(NOW.getTime() - 86400000).toISOString(), lastInboundAt: new Date(NOW.getTime() - 172800000).toISOString(), mode: 'bot', assignedUserId: null, waitingHuman: true, unread: 1, currentState: 'awaiting_reply' },
]

function mockApi() {
  return {
    fetchMessages: async () => MOCK_MESSAGES,
    fetchConversations: async () => MOCK_CONVERSATIONS,
    sendMessage: async (_id: string, text: string) => ({
      id: String(Date.now()), type: 'text' as const, content: text,
      direction: 'outbound' as const, sender: 'agent' as const,
      timestamp: new Date().toISOString(), status: 'sent' as const,
    }),
    sendMedia: async () => ({ id: String(Date.now()), type: 'image' as const, direction: 'outbound' as const, sender: 'agent' as const, timestamp: new Date().toISOString() }),
    sendTemplate: async () => {},
    markRead: async () => {},
    getContext: async () => ({}),
    getDocuments: async () => [],
    getDocumentUrl: async () => '',
    getMediaProxyUrl: async () => ({ mimeType: 'image/jpeg', data: '' }),
  }
}

function mockSse() { return { connectConversationStream: () => new EventSource(''), connectGlobalStream: () => new EventSource('') } }

function formatPhone(number: string) {
  const d = number.replace(/\D/g, '')
  if (d.length >= 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`
  return number
}

// ——— Install Banner ———

function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  async function install() {
    if (!deferredPrompt) return
    await (deferredPrompt as Event & { prompt: () => Promise<void> }).prompt()
    setShow(false)
  }
  if (!show) return null
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-[#233138] rounded-xl shadow-lg p-4 z-50 border border-[#374045]">
      <p className="text-white text-sm font-medium mb-2">Instalar Ada UI</p>
      <p className="text-[#8696a0] text-xs mb-3">Adicione à tela inicial</p>
      <div className="flex gap-2">
        <button onClick={() => setShow(false)} className="flex-1 py-2 text-sm text-white border border-[#374045] rounded-lg hover:bg-[#2a3942]">Agora não</button>
        <button onClick={install} className="flex-1 py-2 text-sm bg-[#00a884] text-white font-medium rounded-lg hover:bg-[#06cf9c]">Instalar</button>
      </div>
    </div>
  )
}

// ——— WhatsApp Web UI ———

function WhatsAppLayout() {
  const [selected, setSelected] = useState<string | null>('1')
  const [composerText, setComposerText] = useState('')
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const { show } = useToast()

  function handleSend() {
    if (!composerText.trim()) return
    const newMsg: MessagePayload = {
      id: String(Date.now()), type: 'text', content: composerText,
      direction: 'outbound', sender: 'agent', timestamp: new Date().toISOString(),
      status: 'sent', isFirstInGroup: true, isLastInGroup: true,
    }
    setMessages(prev => [...prev, newMsg])
    setComposerText('')
    show('success', 'Enviado')
  }

  const activeConv = MOCK_CONVERSATIONS.find(c => c.id === selected)

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-[420px] flex-shrink-0 flex flex-col border-r border-[#e9edef] bg-white">
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between bg-[#f0f2f5]">
          <Avatar name="Admin" size="md" />
          <div className="flex items-center gap-1">
            {['status', 'new-chat', 'menu'].map(key => (
              <button key={key} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#d9dbd9] transition-colors text-[#54656f]">
                {key === 'status' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
                {key === 'new-chat' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}
                {key === 'menu' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-[#f0f2f5] border-b border-[#e9edef]">
          <div className="bg-white rounded-lg flex items-center px-3 py-1.5 shadow-sm border border-transparent focus-within:border-[#00a884] transition-colors">
            <Search size="18" className="text-[#667781] shrink-0" />
            <Input
              placeholder="Pesquisar ou começar uma nova conversa"
              className="border-0 shadow-none h-auto px-3 py-0 text-sm bg-transparent focus-visible:ring-0 placeholder:text-[#667781]"
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {MOCK_CONVERSATIONS.map(conv => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              selected={selected === conv.id}
              onSelect={(id) => setSelected(id)}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Chat */}
      {selected && activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-16 px-4 flex items-center gap-3 bg-[#f0f2f5] border-b border-[#e9edef]">
            <button onClick={() => setSelected(null)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#d9dbd9] text-[#54656f] shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <Avatar name={activeConv.clientName ?? activeConv.whatsappNumber} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-[#111b21] text-base font-semibold truncate">{activeConv.clientName ?? formatPhone(activeConv.whatsappNumber)}</p>
              <p className="text-[#667781] text-[13px]">online</p>
            </div>
            <div className="flex items-center gap-0.5">
              {['search', 'paperclip', 'menu'].map(key => (
                <button key={key} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#d9dbd9] transition-colors text-[#54656f]">
                  {key === 'search' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                  {key === 'paperclip' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}
                  {key === 'menu' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto wa-wallpaper">
            <div className="py-2">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="px-3 py-2.5 bg-[#f0f2f5]">
            <MessageComposer
              value={composerText}
              onChange={setComposerText}
              onSend={handleSend}
              placeholder="Digite uma mensagem"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center flex-col wa-wallpaper">
          <div className="w-[320px] h-[320px] rounded-full bg-[#f0f2f5] flex items-center justify-center">
            <svg width="160" height="160" viewBox="0 0 320 320" className="text-[#d9dbd9]">
              <rect width="320" height="320" rx="40" fill="currentColor"/>
              <circle cx="160" cy="120" r="50" fill="#e9edef"/>
              <path d="M40 260 Q160 160 280 260" fill="#e9edef"/>
            </svg>
          </div>
          <p className="text-[#54656f] text-sm mt-4">Selecione uma conversa</p>
        </div>
      )}

      <InstallBanner />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ConversationsProvider api={mockApi()} sse={mockSse()}>
        <WhatsAppLayout />
      </ConversationsProvider>
    </ToastProvider>
  )
}
