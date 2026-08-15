/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

import { AdaBookingWidget } from './AdaBookingWidget'
import { WIDGET_TAG_NAME } from './widget.constant'

/** Idempotente: importar o pacote duas vezes na mesma página (bundlers, HMR) não deve lançar. */
export function registerAdaBookingWidget(): void {
  if (customElements.get(WIDGET_TAG_NAME)) return

  customElements.define(WIDGET_TAG_NAME, AdaBookingWidget)
}

registerAdaBookingWidget()

export { AdaBookingWidget } from './AdaBookingWidget'
export { WIDGET_TAG_NAME, API_BASE_ATTRIBUTE, THEME_ATTRIBUTE, WIDGET_PATH, WIDGET_STEP } from './widget.constant'
export { WidgetApi } from './widget.api'
export { WidgetRequestError } from './widget.error'
export type {
  ThemeTokens,
  WidgetBookingResult,
  WidgetResource,
  WidgetService,
  WidgetSlot,
  WidgetState,
  WidgetStep,
} from './types/widget.types'
