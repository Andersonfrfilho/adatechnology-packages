/**
 * Visão lado-cliente: você digita como se fosse o cliente e vê o bot responder. A mensagem sai pelo
 * transporte real do canal — webhook assinado no WhatsApp, rota pública do widget no chat do site —,
 * então o que roda aqui é o mesmo caminho de staging e produção: parser, motor de conversa, fluxo.
 *
 * O canal entra por `client` (a porta `ConversationSimulatorClient`), não por condicional aqui
 * dentro: esta tela não sabe qual canal está simulando, e é o que permite o painel ficar no mesmo
 * lugar da conversa para todos eles.
 *
 * É o layout de conversa de verdade (wallpaper, divisor de data, agrupamento de bolhas), não uma
 * casca de teste: o preview serve para julgar copy e fluxo, e isso só funciona se o que se vê
 * aqui for o que o cliente vê no aparelho dele.
 *
 * O SSE só avisa que algo mudou (`{ direction, sender }`, sem conteúdo), então a chegada de um
 * evento dispara refetch. É assim que o servidor funciona; renderizar direto do evento
 * funcionaria no mock e quebraria em produção.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { InteractiveSelection, MessagePayload } from '../types'
import type { SSEProvider } from '../providers/types'
import { MessageBubble } from '../MessageBubble'
import { MessageComposer } from '../MessageComposer'
import { DateDivider } from '../DateDivider'
import { ConversationWallpaper } from '../Wallpaper'
import type { PreviewWebhookClient } from './createPreviewWebhookClient'
import {
  acceptsMediaKind,
  isConversationSimulatorClient,
  mediaKindOf,
  SIMULATOR_FILE_MEDIA_KINDS,
  toConversationSimulatorClient,
  type ConversationSimulatorClient,
  type SimulatorMediaKind,
} from './ConversationSimulatorClient'
import { AudioRecorderButton } from '../AudioRecorderButton'

export type ConversationPreviewProps = {
  /**
   * Transporte do canal. `PreviewWebhookClient` continua aceito — é o caminho WhatsApp de antes
   * desta porta, adaptado aqui dentro para não obrigar host nenhum a mudar de chamada.
   */
  client: ConversationSimulatorClient | PreviewWebhookClient
  sse: SSEProvider
  conversationId: string
  loadMessages: (conversationId: string) => Promise<MessagePayload[]>
  placeholder?: string
  /**
   * Recarrega o transcript a cada N ms. Serve a host SEM stream: a resposta do bot é assíncrona, e
   * sem SSE nem polling ela só apareceria no próximo envio — o sintoma é "às vezes ele não
   * responde". Ausente, não faz polling (host com SSE não precisa).
   */
  pollIntervalMs?: number
  /**
   * Destino alternativo do upload, no canal que sobe a mídia antes de citá-la (o caminho da Meta
   * entrega mídia por `id`). Sem isto, usa o do próprio `client`. Canal que manda os bytes direto
   * ignora esta prop: quem decide referência × bytes é o adaptador do canal.
   */
  uploadMedia?: (file: File) => Promise<PreviewUploadedMedia>
}

export type PreviewUploadedMedia = {
  readonly mediaId: string
  readonly mimeType?: string
  readonly filename?: string
}

/** @deprecated Use `mediaKindOf`, que não nomeia canal. Mantido para quem já importa. */
export function mediaTypeOf(mimeType: string): SimulatorMediaKind {
  return mediaKindOf(mimeType)
}

// Mesma janela usada pelo WhatsApp para colar bolhas do mesmo autor: acima disso, a mensagem
// recomeça um grupo (com rabicho e espaçamento maior).
const GROUPING_WINDOW_MS = 5 * 60 * 1000

// Escalonado, não um atraso fixo: a maioria das respostas chega em ~300ms, mas fluxo que consulta
// catálogo ou IA demora mais — e recarregar três vezes é mais barato que a conversa parecer morta.
const FOLLOW_UP_REFRESH_MS = [400, 1200, 3000]

type RenderedMessage = {
  readonly message: MessagePayload
  readonly isFirstInGroup: boolean
  readonly showDateDivider: boolean
}

function decorate(messages: readonly MessagePayload[]): RenderedMessage[] {
  return messages.map((message, index) => {
    const previous = index > 0 ? messages[index - 1] : undefined
    const currentTime = new Date(message.timestamp).getTime()
    const previousTime = previous ? new Date(previous.timestamp).getTime() : 0

    return {
      message,
      isFirstInGroup:
        !previous || previous.sender !== message.sender || currentTime - previousTime > GROUPING_WINDOW_MS,
      showDateDivider:
        !previous || new Date(message.timestamp).toDateString() !== new Date(previous.timestamp).toDateString(),
    }
  })
}

/**
 * Status HTTP do erro, quando o host o preserva.
 *
 * O contrato não exige um tipo de erro — cada host tem o seu —, então a leitura é estrutural: basta
 * carregar `status` (ou `statusCode`) para ser classificável. Host que joga `new Error(texto)` cai no
 * caminho genérico, que ainda é melhor que silêncio.
 */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown }
  const value = candidate.status ?? candidate.statusCode
  return typeof value === 'number' ? value : undefined
}

export function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404
}

export function describeLoadFailure(error: unknown): string {
  const status = statusOf(error)
  // 401/403 no simulador quase sempre é a aba sem sessão: `sessionStorage` é por aba, e link com
  // `rel="noreferrer"` abre contexto novo que não herda o token do painel.
  if (status === 401 || status === 403) {
    return 'Sem sessão de administrador nesta aba: a mensagem é entregue no webhook, mas o transcript não pode ser lido. Entre no painel nesta mesma aba e reabra o simulador.'
  }
  if (error instanceof Error && error.message) return `Não foi possível ler o transcript: ${error.message}`
  return 'Não foi possível ler o transcript da conversa.'
}

export function ConversationPreview({
  client,
  sse,
  conversationId,
  loadMessages,
  placeholder,
  pollIntervalMs,
  uploadMedia,
}: ConversationPreviewProps) {
  const [messages, setMessages] = useState<MessagePayload[]>([])
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [loadFailure, setLoadFailure] = useState<string | undefined>(undefined)
  const [isRecording, setIsRecording] = useState(false)
  // Mensagens que o servidor ainda não devolveu. Sem isto, quem não consegue LER a conversa (sessão
  // ausente, API fora) digita, envia com sucesso e não vê absolutamente nada mudar — o preview fica
  // indistinguível de quebrado. São descartadas assim que uma leitura dá certo: aí quem manda na
  // tela é o servidor, que já tem a mensagem gravada.
  const [pendingLocal, setPendingLocal] = useState<MessagePayload[]>([])
  const loadMessagesRef = useRef(loadMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  loadMessagesRef.current = loadMessages

  const simulator = useMemo(
    () =>
      isConversationSimulatorClient(client)
        ? client
        : toConversationSimulatorClient({ client, ...(uploadMedia ? { uploadMedia } : {}) }),
    [client, uploadMedia],
  )

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const loaded = await loadMessagesRef.current(conversationId)
      setMessages(loaded)
      setLoadFailure(undefined)
      // Só descarta o eco quando o servidor de fato devolveu conversa: lista vazia é "não consegui
      // ver nada" (sessão ausente, primeiro contato), e limpar aí apagava da tela a mensagem que o
      // usuário acabou de mandar — o sintoma que este eco existe para evitar.
      if (loaded.length > 0) setPendingLocal([])
    } catch (error) {
      // Conversa que ainda não existe é o estado normal do primeiro contato — transcript vazio, sem
      // alarme. QUALQUER outra falha precisa aparecer: engolir todas era o que transformava sessão
      // expirada (401) em silêncio absoluto, com a thread limpa e o operador concluindo que o envio
      // não funcionou — quando a mensagem tinha sido entregue no webhook.
      if (isNotFound(error)) {
        setMessages([])
        setLoadFailure(undefined)
        return
      }

      // Não limpa o que já está na tela: perder o histórico por causa de um refresh que falhou é
      // dano maior que o próprio erro.
      setLoadFailure(describeLoadFailure(error))
    }
  }, [conversationId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const source = sse.connectConversationStream(conversationId)
    const handler = (): void => {
      void refresh()
    }

    source.addEventListener('message', handler)
    return () => {
      source.removeEventListener('message', handler)
      source.close()
    }
  }, [sse, conversationId, refresh])

  useEffect(() => {
    if (!pollIntervalMs) return
    const timer = setInterval(() => void refresh(), pollIntervalMs)
    return () => clearInterval(timer)
  }, [pollIntervalMs, refresh])

  useEffect(() => {
    // `block: 'nearest'` e não o padrão ('start'): o padrão alinha o elemento ao topo da área
    // visível MAIS PRÓXIMA que role — e quando o container do preview não tem altura limitada, essa
    // área é a PÁGINA. O efeito era a tela inteira saltar para baixo ao abrir/usar o simulador.
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const rendered = useMemo(() => decorate([...messages, ...pendingLocal]), [messages, pendingLocal])

  async function refreshWithFollowUps(): Promise<void> {
    await refresh()
    for (const atraso of FOLLOW_UP_REFRESH_MS) {
      setTimeout(() => void refresh(), atraso)
    }
  }

  async function handleSend(text: string): Promise<void> {
    setFailure(undefined)
    try {
      await simulator.sendText(text)
      setPendingLocal((current) => [
        ...current,
        {
          id: `local-${current.length}-${text.length}`,
          type: 'text',
          content: text,
          // Do ponto de vista do servidor, mensagem do cliente é inbound — é assim que ela aparece
          // como "minha" nesta visão.
          direction: 'inbound',
          sender: 'customer',
          timestamp: new Date().toISOString(),
          status: 'sent',
        },
      ])
      // O bot responde de forma assíncrona: gravar a resposta leva algumas centenas de ms depois do
      // 200 do webhook. Um refresh único aqui frequentemente chegava ANTES dela, e a conversa ficava
      // com a pergunta sem resposta até o envio seguinte.
      await refreshWithFollowUps()
    } catch (error) {
      // A recusa mais provável é assinatura inválida (segredo divergente do que a API valida), e
      // ela precisa aparecer na tela: silenciada, o sintoma vira "mandei e não aconteceu nada".
      setFailure(error instanceof Error ? error.message : 'Falha ao entregar a mensagem no webhook.')
    }
  }

  async function handleInteractiveSelect(selection: InteractiveSelection): Promise<void> {
    setFailure(undefined)
    try {
      // A seleção viaja inteira (botão × lista) porque a forma de fio é do canal: a Meta separa
      // `button_reply` de `list_reply` e o roteador do fluxo lê campos distintos, enquanto o chat do
      // site manda o rótulo como texto. Decidir isso aqui faria o menu responder no simulador e
      // falhar no aparelho do cliente.
      await simulator.sendReply(selection)
      await refreshWithFollowUps()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Falha ao entregar a resposta no webhook.')
    }
  }

  /**
   * O transporte do canal diz se aceita mídia do cliente; a tela só pergunta.
   *
   * Antes isto era `uploadMedia` puro, e o microfone só aparecia no produto que lembrasse de montar
   * o upload — de onde veio a divergência entre dois simuladores da mesma casa. Agora quem responde
   * é o adaptador: no WhatsApp ele precisa de um destino de upload, no chat do site manda os bytes.
   */
  const sendMedia = simulator.sendMedia
  const canAttachFile = SIMULATOR_FILE_MEDIA_KINDS.some((kind) => acceptsMediaKind(simulator, kind))
  const canRecordAudio = acceptsMediaKind(simulator, 'audio')

  async function handleAttach(file: File): Promise<void> {
    if (!sendMedia) return
    setFailure(undefined)
    try {
      await sendMedia({
        mediaKind: mediaKindOf(file.type),
        file,
        mimeType: file.type,
        filename: file.name,
      })
      await refreshWithFollowUps()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Falha ao enviar o arquivo.')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConversationWallpaper className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {rendered.map(({ message, isFirstInGroup, showDateDivider }) => (
          <div key={message.id}>
            {showDateDivider ? <DateDivider iso={message.timestamp} /> : null}
            <MessageBubble
              message={message}
              // Na visão do cliente, "minha" mensagem é a que ele enviou — inbound do ponto de
              // vista do servidor.
              isMine={message.direction === 'inbound'}
              isFirstInGroup={isFirstInGroup}
              // Só o que o bot ofereceu é tocável: reoferecer as opções da própria mensagem do
              // cliente deixaria o menu clicável para sempre, o que o WhatsApp não faz.
              onInteractiveSelect={
                message.direction === 'outbound' ? (selection) => void handleInteractiveSelect(selection) : undefined
              }
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </ConversationWallpaper>

      {failure ? (
        <p role="alert" className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      ) : null}

      {/* Separado da falha de ENVIO: são causas diferentes e confundi-las manda o operador
          investigar assinatura de webhook quando o problema é sessão. Amarelo, não vermelho — a
          mensagem foi entregue; o que faltou foi poder ler a conversa de volta. */}
      {loadFailure ? (
        <p role="status" className="px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          {loadFailure}
        </p>
      ) : null}

      <MessageComposer
        onSend={(text) => void handleSend(text)}
        onAttach={canAttachFile ? (file) => void handleAttach(file) : undefined}
        /* Gravando, o campo diz o que falta fazer: o botão é um interruptor e o segundo toque é
           que envia — sem esse aviso o operador grava, não vê nada acontecer e conclui que o
           microfone está quebrado. */
        placeholder={
          isRecording ? 'Gravando… toque no quadrado para ouvir' : (placeholder ?? 'Escreva como o cliente…')
        }
        idleAction={
          canRecordAudio ? (
            <AudioRecorderButton
              onRecorded={(file) => void handleAttach(file)}
              onFailure={(message) => setFailure(message)}
              onRecordingChange={setIsRecording}
            />
          ) : undefined
        }
      />
    </div>
  )
}
