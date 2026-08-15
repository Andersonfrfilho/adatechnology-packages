/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

/**
 * Folha única do shadow root, sem cor de marca própria (spec T8.3).
 *
 * O fallback de cada `var()` é neutro (cinza/preto) de propósito: este widget é distribuído para
 * qualquer host, e a cor de verdade vem do atributo `theme` (ver `widget.theme.ts`). Sem o atributo,
 * o widget continua legível — só não veste a marca de ninguém.
 */
export const WIDGET_STYLE = `
:host {
  --ada-booking-primary: #111827;
  --ada-booking-primary-contrast: #ffffff;
  --ada-booking-surface: #ffffff;
  --ada-booking-bg: #f3f4f6;
  --ada-booking-text: #111827;
  --ada-booking-muted: #6b7280;
  --ada-booking-border: #e5e7eb;
  --ada-booking-radius: 12px;
  --ada-touch: 44px;
  --ada-font: system-ui, sans-serif;

  position: fixed;
  right: 12px;
  bottom: 12px;
  left: 12px;
  z-index: 2147483000;
  font-family: var(--ada-font);
  color: var(--ada-booking-text);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }

.launcher {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--ada-touch);
  margin-left: auto;
  padding: 0 20px;
  border-radius: 999px;
  background: var(--ada-booking-primary);
  color: var(--ada-booking-primary-contrast);
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.24);
}

.launcher svg { width: 20px; height: 20px; }
.launcher:focus-visible { outline: 3px solid var(--ada-booking-primary); outline-offset: 3px; }
.launcher[hidden] { display: none; }

.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(80vh, calc(100vh - 96px));
  border-radius: var(--ada-booking-radius);
  background: var(--ada-booking-surface);
  border: 1px solid var(--ada-booking-border);
  box-shadow: 0 24px 60px rgba(17, 24, 39, 0.2);
  overflow: hidden;
}

.panel[hidden] { display: none; }

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--ada-booking-primary);
  color: var(--ada-booking-primary-contrast);
}

.header-title { flex: 1; min-width: 0; font-weight: 600; }

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ada-touch);
  height: var(--ada-touch);
  flex: none;
  border-radius: 50%;
}

.icon-button svg { width: 20px; height: 20px; }
.icon-button:hover { background: rgba(255, 255, 255, 0.14); }
.icon-button:focus-visible { outline: 2px solid var(--ada-booking-primary-contrast); outline-offset: -2px; }
.icon-button[hidden] { display: none; }

.close { color: var(--ada-booking-primary-contrast); font-size: 1.4rem; line-height: 1; }

.body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.list { display: flex; flex-direction: column; gap: 8px; }

.item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: var(--ada-touch);
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--ada-booking-radius);
  border: 1px solid var(--ada-booking-border);
  background: var(--ada-booking-bg);
  text-align: left;
}

.item:hover { border-color: var(--ada-booking-primary); }
.item:focus-visible { outline: 2px solid var(--ada-booking-primary); outline-offset: 2px; }
.item-title { font-weight: 600; }
.item-subtitle { font-size: 0.82rem; color: var(--ada-booking-muted); }

.empty, .status { padding: 8px 2px; font-size: 0.9rem; color: var(--ada-booking-muted); }
.status-error { color: #b42318; }

.timezone-note {
  padding: 0 2px 10px;
  font-size: 0.78rem;
  color: var(--ada-booking-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.input {
  min-height: var(--ada-touch);
  padding: 0 14px;
  border: 1px solid var(--ada-booking-border);
  border-radius: var(--ada-booking-radius);
  font: inherit;
  color: inherit;
  background: var(--ada-booking-surface);
}

.input::placeholder { color: var(--ada-booking-muted); }
.input:focus-visible { outline: 2px solid var(--ada-booking-primary); outline-offset: 0; }

.summary {
  padding: 10px 12px;
  border-radius: var(--ada-booking-radius);
  background: var(--ada-booking-bg);
  font-size: 0.88rem;
  margin-bottom: 14px;
}

.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--ada-touch);
  width: 100%;
  border-radius: var(--ada-booking-radius);
  background: var(--ada-booking-primary);
  color: var(--ada-booking-primary-contrast);
  font-weight: 600;
}

.primary-button:disabled { opacity: 0.55; cursor: not-allowed; }
.primary-button:focus-visible { outline: 3px solid var(--ada-booking-primary); outline-offset: 2px; }

.confirmed { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 8px; text-align: center; }
.confirmed svg { width: 40px; height: 40px; color: var(--ada-booking-primary); }

@media (min-width: 640px) {
  :host { right: 20px; bottom: 20px; left: auto; }
  .panel { width: 380px; }
}

@media (prefers-reduced-motion: reduce) {
  .launcher { transition: none; }
}
`

/** `adoptedStyleSheets` não passa por `style-src`, então o host pode manter CSP sem `'unsafe-inline'`. */
let sharedSheet: CSSStyleSheet | undefined

export function applyWidgetStyle(root: ShadowRoot): void {
  if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
    if (sharedSheet === undefined) {
      sharedSheet = new CSSStyleSheet()
      sharedSheet.replaceSync(WIDGET_STYLE)
    }
    root.adoptedStyleSheets = [sharedSheet]
    return
  }

  const style = document.createElement('style')
  style.textContent = WIDGET_STYLE
  root.append(style)
}
