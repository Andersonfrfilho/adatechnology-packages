/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Transporte do simulador de cliente no chat do site.
 *
 * O painel do atendente precisa falar como o visitante para testar o fluxo, e o único jeito honesto
 * de fazer isso é usar as MESMAS rotas que o widget usa — `/v1/widget/*`, sessão, sem assinatura.
 * Reimplementar essas rotas do lado do painel duplicaria o conhecimento do protocolo em dois
 * pacotes, e o dia em que a rota mudasse só um dos dois seria corrigido.
 *
 * Mora aqui, e não no pacote da inbox, porque quem é dono do protocolo é este pacote. A porta que a
 * inbox declara é satisfeita **estruturalmente**: nenhum import atravessa os dois lados, e a
 * incompatibilidade, se aparecer, estoura em compile-time no produto que liga um no outro.
 *
 * Vive num subcaminho próprio (`@adatechnology/web-chat-widget/simulator`) porque a entrada
 * principal registra o custom element ao ser importada — o painel do atendente não quer o widget
 * definido na própria página, só o cliente HTTP dele.
 */

import { WidgetApi } from '../widget.api'

export type WebChatSimulatorMediaKind = 'image' | 'video' | 'audio' | 'document'

/**
 * Só o que o transporte lê da seleção, declarado localmente para não depender da inbox.
 *
 * Mais largo que o tipo de lá de propósito: é o que torna a compatibilidade estrutural, sem que este
 * pacote passe a conhecer `InteractiveSelection`.
 */
type SimulatorSelection = {
  readonly option: { readonly title: string }
}

type SendSimulatorMediaParams = {
  readonly mediaKind: WebChatSimulatorMediaKind
  readonly file: Blob
}

export type WebChatSimulatorClient = {
  sendText(text: string): Promise<void>
  sendReply(selection: SimulatorSelection): Promise<void>
  sendMedia(params: SendSimulatorMediaParams): Promise<void>
  readonly acceptedMediaKinds: readonly WebChatSimulatorMediaKind[]
}

export type CreateWebChatSimulatorClientParams = {
  /** Origem da API do chat. A rota confere o `Origin`, então a do painel precisa estar na allowlist. */
  readonly baseUrl: string
  /** Sessão da conversa que está aberta na inbox — é o identificador do contato no canal webchat. */
  readonly sessionId: string
}

/**
 * O chat sobe áudio porque a API transcreve; imagem e arquivo não têm rota.
 *
 * Declarar a lista é o que mantém o clipe escondido e o microfone visível — sem ela o compositor
 * desenharia os dois e um deles falharia ao ser tocado.
 */
const WEB_CHAT_MEDIA_KINDS: readonly WebChatSimulatorMediaKind[] = ['audio']

export function createWebChatSimulatorClient({
  baseUrl,
  sessionId,
}: CreateWebChatSimulatorClientParams): WebChatSimulatorClient {
  const api = new WidgetApi({ baseUrl })

  return {
    acceptedMediaKinds: WEB_CHAT_MEDIA_KINDS,

    sendText: async (text) => {
      await api.postMessage({ sessionId, text })
    },

    /**
     * Toque em opção vai como TEXTO com o rótulo.
     *
     * Não é simplificação: é o que o botão do widget faz. O canal não tem forma de fio para resposta
     * de menu, e mandar o `id` aqui testaria um caminho que visitante nenhum produz.
     */
    sendReply: async (selection) => {
      await api.postMessage({ sessionId, text: selection.option.title })
    },

    sendMedia: async ({ mediaKind, file }) => {
      // Guarda de fronteira: `acceptedMediaKinds` esconde o affordance, mas host pode chamar direto —
      // e imagem na rota de áudio iria para a transcrição em silêncio.
      if (mediaKind !== 'audio') throw new Error(`web chat simulator does not accept ${mediaKind}`)

      await api.postAudio({ sessionId, audio: file })
    },
  }
}
