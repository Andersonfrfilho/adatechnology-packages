/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { AdaChatWidget } from './AdaChatWidget'
import { API_BASE_ATTRIBUTE, WIDGET_TAG_NAME } from './widget.constant'

/**
 * Registrar duas vezes lanca; importar duas vezes nao deveria quebrar a pagina do host.
 *
 * Acontece com HMR em desenvolvimento e com o host que carrega o bundle em mais de um ponto — a
 * checagem custa nada e evita derrubar a landing inteira por causa do widget.
 */
export function registerAdaChatWidget(): void {
  if (customElements.get(WIDGET_TAG_NAME)) return

  customElements.define(WIDGET_TAG_NAME, AdaChatWidget)
}

registerAdaChatWidget()

export { AdaChatWidget }
export { API_BASE_ATTRIBUTE, WIDGET_TAG_NAME }
