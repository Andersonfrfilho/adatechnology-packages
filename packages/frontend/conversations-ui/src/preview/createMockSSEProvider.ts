/**
 * `SSEProvider` servido pelo store em memória. Mesmo mapeamento de canal do servidor
 * (`conv:<conversationId>` e `global`), para que a UI não perceba a troca.
 */

import type { SSEProvider } from '../providers/types'
import { createMockEventSource } from './mockEventSource'
import { conversationChannel, GLOBAL_CHANNEL, type PreviewStore } from './previewStore'

export type CreateMockSSEProviderParams = {
  readonly store: PreviewStore
}

export function createMockSSEProvider(params: CreateMockSSEProviderParams): SSEProvider {
  function connect(channel: string): ReturnType<typeof createMockEventSource> {
    const source = createMockEventSource()
    const unsubscribe = params.store.subscribe(channel, (emission) => {
      source.emit(emission.event, emission.payload)
    })

    const close = source.close.bind(source)
    // O unsubscribe tem de acontecer no close, senão cada remontagem de componente deixa um
    // listener preso no store e a mesma mensagem chega duplicada na UI.
    source.close = (): void => {
      unsubscribe()
      close()
    }

    return source
  }

  return {
    connectConversationStream(conversationId: string) {
      return connect(conversationChannel(conversationId))
    },
    connectGlobalStream() {
      return connect(GLOBAL_CHANNEL)
    },
  }
}
