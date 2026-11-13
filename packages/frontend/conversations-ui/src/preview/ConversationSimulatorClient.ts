/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 *
 * Author: Anderson Filho <andersonfrfilho@gmail.com>
 *
 * Porta do simulador: o que a visão lado-cliente precisa saber fazer, sem canal no nome.
 *
 * O simulador nasceu falando WhatsApp — `PreviewWebhookClient`, payload assinado, mídia por
 * `mediaId`. Só que a mesma casa atende pelo chat do próprio site, e simular ali não é uma segunda
 * tela: é o mesmo painel, no mesmo lugar da conversa, com outro transporte. Sem esta porta cada
 * canal novo viraria uma cópia da tela — e cópia de tela diverge, que é exatamente o que o
 * `ConversationSimulatorPanel` existe para ter parado.
 *
 * O que é específico de canal fica no adaptador, nunca aqui:
 * - **resposta de menu:** a Meta distingue `button_reply` de `list_reply`, e o roteador do fluxo lê
 *   campos diferentes; o chat do site manda o rótulo como texto, que é literalmente o que o
 *   visitante produz ao tocar no botão do widget. A porta entrega a seleção inteira e deixa cada
 *   adaptador escolher a forma de fio.
 * - **mídia:** a Meta entrega por REFERÊNCIA (sobe o arquivo primeiro, o webhook carrega o `id`); o
 *   widget manda os BYTES no `FormData`. A porta trafega o `File` que a tela tem em mão — quem
 *   tiver passo de upload faz o upload por dentro.
 */

import type { InteractiveSelection } from '../types'
import type { PreviewUploadedMedia } from './createPreviewMediaUploader'
import type { PreviewWebhookClient } from './createPreviewWebhookClient'

/**
 * Tipos de mídia que o cliente pode mandar de dentro do simulador.
 *
 * Subconjunto proposital do que a Meta aceita: `sticker` chega do aparelho, mas não há como
 * escolher um no seletor de arquivo do navegador — oferecer o tipo aqui seria um caminho morto.
 */
export type SimulatorMediaKind = 'image' | 'video' | 'audio' | 'document'

/** Os tipos que saem do seletor de arquivo. `audio` fica de fora: ele vem do microfone. */
export const SIMULATOR_FILE_MEDIA_KINDS: readonly SimulatorMediaKind[] = ['image', 'video', 'document']

/** Deriva o tipo de mídia a partir do MIME do arquivo escolhido. */
export function mediaKindOf(mimeType: string): SimulatorMediaKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

export type SendSimulatorMediaParams = {
  readonly mediaKind: SimulatorMediaKind
  /** O arquivo do disco ou o áudio recém-gravado. Referência × bytes é decisão do adaptador. */
  readonly file: File
  readonly mimeType?: string
  readonly filename?: string
  readonly caption?: string
}

export type ConversationSimulatorClient = {
  sendText(text: string): Promise<void>
  sendReply(selection: InteractiveSelection): Promise<void>
  /**
   * Ausente = este canal não recebe mídia do cliente, e o compositor não desenha clipe nem
   * microfone. Melhor um botão que não existe do que um que falha ao ser tocado.
   */
  sendMedia?(params: SendSimulatorMediaParams): Promise<void>
  /**
   * Restringe o que `sendMedia` aceita. Ausente = todos os tipos.
   *
   * Existe porque canal com meia capacidade é comum: o chat do site sobe áudio (a API transcreve)
   * mas não tem rota para imagem. Sem esta lista o clipe e o microfone apareciam juntos, e um dos
   * dois falhava ao ser tocado.
   */
  readonly acceptedMediaKinds?: readonly SimulatorMediaKind[]
}

/** Responde se o compositor deve desenhar o affordance daquele tipo. */
export function acceptsMediaKind(client: ConversationSimulatorClient, kind: SimulatorMediaKind): boolean {
  if (!client.sendMedia) return false

  return client.acceptedMediaKinds?.includes(kind) ?? true
}

export type ToSimulatorClientParams = {
  readonly client: PreviewWebhookClient
  /** Destino alternativo do upload. Sem isto, usa o do próprio `client`. */
  readonly uploadMedia?: (file: File) => Promise<PreviewUploadedMedia>
}

/**
 * Distingue a porta neutra do cliente WhatsApp legado, que continua aceito na prop.
 *
 * Leitura estrutural e não `instanceof`: os dois são objetos literais devolvidos por fábrica, e o
 * host pode ter montado o seu à mão.
 */
export function isConversationSimulatorClient(
  candidate: ConversationSimulatorClient | PreviewWebhookClient,
): candidate is ConversationSimulatorClient {
  return typeof (candidate as ConversationSimulatorClient).sendReply === 'function'
}

/**
 * Adapta o cliente WhatsApp (webhook assinado ou ponte) para a porta neutra.
 *
 * O upload vive aqui dentro porque ele é uma etapa DO CANAL: no caminho da Meta a mídia precisa
 * existir como `id` antes do webhook citá-la. Sem passo de upload disponível, `sendMedia` sai
 * ausente — é o que mantém o clipe escondido em host que não montou destino para o arquivo, o
 * comportamento que já existia antes desta porta.
 */
export function toConversationSimulatorClient({
  client,
  uploadMedia,
}: ToSimulatorClientParams): ConversationSimulatorClient {
  const upload = uploadMedia ?? client.uploadMedia

  const base: ConversationSimulatorClient = {
    sendText: (text) => client.sendText(text),
    sendReply: (selection) => {
      const reply = { id: selection.option.id, title: selection.option.title }
      return selection.kind === 'button' ? client.sendButtonReply(reply) : client.sendListReply(reply)
    },
  }

  if (!upload) return base

  return {
    ...base,
    sendMedia: async ({ mediaKind, file, mimeType, filename, caption }) => {
      const uploaded = await upload(file)
      await client.sendMedia({
        // O tipo sai do MIME que o upload devolveu quando ele existe: host que normaliza o formato
        // (áudio gravado em `webm` que sobe como `ogg`) mudava de tipo, e a mídia chegava como
        // documento.
        mediaType: uploaded.mimeType ? mediaKindOf(uploaded.mimeType) : mediaKind,
        mediaId: uploaded.mediaId,
        mimeType: uploaded.mimeType ?? mimeType ?? file.type,
        filename: uploaded.filename ?? filename ?? file.name,
        ...(caption ? { caption } : {}),
      })
    },
  }
}
