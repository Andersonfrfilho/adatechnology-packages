/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

/**
 * Folha unica do shadow root, com os tokens declarados em `:host`.
 *
 * O shadow DOM e o que permite embutir o widget em qualquer site sem herdar nem vazar CSS. Os tokens
 * ficam em `:host` de proposito: sao a superficie de customizacao do host, que sobrescreve a variavel
 * sem tocar em nada aqui dentro.
 *
 * O tema escuro segue o sistema do visitante por padrao. Quando o host tem interruptor proprio, ele
 * declara `theme="dark"` ou `theme="light"` no elemento e passa a mandar — sem isso, apagar a luz no
 * site deixava o chat aceso, que e o defeito que se ve.
 */
const DARK_TOKENS = `
  --ada-navy: #0a1430;
  --ada-surface: #131c33;
  --ada-bg: #0d1526;
  --ada-bubble-bot: #1b2743;
  --ada-bubble-visitor: #1e4bb8;
  --ada-text: #e8eeff;
  --ada-muted: #93a4c8;
  --ada-danger: #ff9d94;
  --ada-border: #223055;
`

export const WIDGET_STYLE = `
:host {
  --ada-navy: #0d1b3e;
  --ada-blue: #1a4fd6;
  --ada-cyan: #06b6d4;
  --ada-surface: #ffffff;
  --ada-bg: #eef2fb;
  --ada-bubble-bot: #ffffff;
  --ada-bubble-visitor: #dbe6ff;
  --ada-text: #1e2a4a;
  --ada-muted: #64748b;
  --ada-danger: #b42318;
  --ada-border: #e2e8f0;
  --ada-radius: 14px;
  --ada-touch: 44px;
  --ada-font: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;

  position: fixed;
  right: 12px;
  bottom: 12px;
  left: 12px;
  z-index: 2147483000;
  font-family: var(--ada-font);
  color: var(--ada-text);
}

/* Sem escolha do host, quem manda e o sistema — e theme="light" precisa vencer o sistema escuro. */
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) { ${DARK_TOKENS} }
}

:host([theme="dark"]) { ${DARK_TOKENS} }

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }

/* --- launcher --- */

.launcher {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ada-touch);
  margin-left: auto;
  padding: 6px 20px 6px 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--ada-blue), var(--ada-cyan));
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(13, 27, 62, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.launcher { position: relative; }
.launcher:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(13, 27, 62, 0.34); }

/* Contador de nao lidas: o launcher fechado e o unico lugar onde a resposta do bot pode se perder. */
.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  border: 2px solid var(--ada-surface);
  background: var(--ada-danger);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  animation: ada-badge-pop 0.28s ease-out;
}

.badge[hidden] { display: none; }

@keyframes ada-badge-pop {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.launcher:focus-visible { outline: 3px solid var(--ada-navy); outline-offset: 3px; }
.launcher[hidden] { display: none; }

/* --- mascote --- */

.mascot { display: block; color: var(--ada-navy); --ada-mascot-accent: var(--ada-cyan); }
.mascot svg { display: block; width: 100%; height: 100%; }

/* Sobre o gradiente azul do launcher e do cabecalho o ciano da marca encostaria no fundo. */
.mascot-launcher { width: 34px; height: 34px; color: #ffffff; --ada-mascot-accent: #a5f3fc; }
.mascot-header {
  width: 38px; height: 38px; flex: none; color: #ffffff; --ada-mascot-accent: #a5f3fc;
}
/* No topo, e nao no rodape: alinhado ao inicio da primeira fala do bloco, nao ao fim dela. */
.mascot-bubble { width: 26px; height: 26px; align-self: flex-start; margin-top: 4px; flex: none; }

/* A 26px as diagonais internas viram borrao: ao lado do balao fica so o triangulo com os nos. */
.mascot-bubble .mascot-mesh { display: none; }

/* A rede respira: os nos pulsam em cascata e o nucleo bate junto, como sinal percorrendo a malha. */
.mascot-node, .mascot-core { transform-box: fill-box; transform-origin: center; }
.mascot-node { animation: ada-node-pulse 3.2s ease-in-out infinite; }
.mascot-core { animation: ada-core-beat 3.2s ease-in-out infinite; }

.node-b { animation-delay: 0.45s; }
.node-c { animation-delay: 0.9s; }

@keyframes ada-node-pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
}

@keyframes ada-core-beat {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.12); opacity: 1; }
}

/* --- painel --- */

.panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: min(72vh, calc(100vh - 96px));
  border-radius: var(--ada-radius);
  background: var(--ada-surface);
  border: 1px solid var(--ada-border);
  box-shadow: 0 24px 60px rgba(13, 27, 62, 0.24);
  overflow: hidden;
}

.panel[hidden] { display: none; }

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--ada-navy);
  color: #ffffff;
}

.header-heading { flex: 1; min-width: 0; }
.header-title { font-weight: 600; letter-spacing: -0.01em; }

.header-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  opacity: 0.78;
}

.header-subtitle::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #35d07f;
}

.close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ada-touch);
  height: var(--ada-touch);
  margin-right: -10px;
  border-radius: 50%;
  font-size: 1.4rem;
  line-height: 1;
}

.close:hover { background: rgba(255, 255, 255, 0.14); }
.close:focus-visible { outline: 2px solid var(--ada-cyan); outline-offset: -2px; }

/* --- transcript --- */

/* O papel de parede e o que tira a cara de formulario: textura discreta, sem imagem externa. */
.transcript {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 14px;
  overflow-y: auto;
  background:
    radial-gradient(circle at 1px 1px, rgba(26, 79, 214, 0.10) 1px, transparent 0) 0 0 / 22px 22px,
    var(--ada-bg);
}

.divider {
  align-self: center;
  margin: 4px 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--ada-surface);
  border: 1px solid var(--ada-border);
  font-size: 0.72rem;
  color: var(--ada-muted);
}

.row { display: flex; align-items: flex-end; gap: 8px; max-width: 88%; }
.row-bot { align-self: flex-start; }
.row-visitor { align-self: flex-end; flex-direction: row-reverse; }
/* Sequencia do mesmo lado: so a primeira bolha ganha avatar e rabinho. */
.row-tight { margin-top: -4px; }

.bubble {
  position: relative;
  padding: 8px 12px 6px;
  border-radius: var(--ada-radius);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  box-shadow: 0 1px 1px rgba(13, 27, 62, 0.10);
}

.bubble-bot { background: var(--ada-bubble-bot); border-top-left-radius: 4px; }
.bubble-visitor { background: var(--ada-bubble-visitor); border-top-right-radius: 4px; }

/* Rabinho em CSS puro: um triangulo por borda, sem SVG e sem imagem por bolha. */
.row-tail .bubble::before {
  content: '';
  position: absolute;
  top: 0;
  border: 7px solid transparent;
}

.row-tail .bubble-bot::before {
  left: -6px;
  border-top-color: var(--ada-bubble-bot);
  border-right-color: var(--ada-bubble-bot);
}

.row-tail .bubble-visitor::before {
  right: -6px;
  border-top-color: var(--ada-bubble-visitor);
  border-left-color: var(--ada-bubble-visitor);
}

.meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 2px;
  font-size: 0.68rem;
  color: var(--ada-muted);
}

.ticks { color: var(--ada-cyan); letter-spacing: -2px; }

/* --- digitando --- */

.typing { display: flex; align-items: center; gap: 4px; padding: 10px 14px; }
.typing[hidden] { display: none; }

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ada-muted);
  animation: ada-typing 1.2s infinite;
}

.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }

@keyframes ada-typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

/* --- opcoes --- */

.options {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 14px 12px;
  background: var(--ada-bg);
}

.options[hidden] { display: none; }

.option {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--ada-blue);
  color: var(--ada-blue);
  background: var(--ada-surface);
  font-size: 0.9rem;
  font-weight: 500;
}

.option:hover { background: var(--ada-blue); color: #ffffff; }
.option:focus-visible { outline: 3px solid var(--ada-cyan); outline-offset: 2px; }
.option:disabled { opacity: 0.55; cursor: not-allowed; }

.status {
  padding: 0 14px 10px;
  font-size: 0.82rem;
  color: var(--ada-muted);
  background: var(--ada-bg);
}

.status[hidden] { display: none; }
.status-error { color: var(--ada-danger); }

/* --- composer --- */

.composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--ada-border);
  background: var(--ada-surface);
}

.input {
  flex: 1;
  min-width: 0;
  min-height: var(--ada-touch);
  padding: 0 14px;
  border: 1px solid var(--ada-border);
  border-radius: 999px;
  font: inherit;
  color: inherit;
  background: var(--ada-bg);
}

.input::placeholder { color: var(--ada-muted); }
.input:focus-visible { outline: 2px solid var(--ada-blue); outline-offset: 0; border-color: var(--ada-blue); }

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ada-touch);
  height: var(--ada-touch);
  flex: none;
  border-radius: 50%;
  font-size: 1.05rem;
}

.mic { color: var(--ada-muted); }
.mic:hover { background: var(--ada-bg); color: var(--ada-blue); }
.mic[hidden] { display: none; }
.mic-recording { background: var(--ada-danger); color: #ffffff; animation: ada-pulse 1.4s infinite; }

@keyframes ada-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(180, 35, 24, 0.5); }
  70% { box-shadow: 0 0 0 10px rgba(180, 35, 24, 0); }
}

.send { background: var(--ada-blue); color: #ffffff; }
.send:hover { background: var(--ada-navy); }
.icon-button:focus-visible { outline: 3px solid var(--ada-cyan); outline-offset: 2px; }
.icon-button:disabled { opacity: 0.55; cursor: not-allowed; }

/* Mobile e a base: o widget ocupa a faixa inteira. A partir de tablet ele volta a ser um cartao. */
@media (min-width: 640px) {
  :host { right: 20px; bottom: 20px; left: auto; }
  .panel { width: 390px; height: min(580px, calc(100vh - 120px)); }
}

@media (prefers-reduced-motion: reduce) {
  .launcher, .launcher:hover { transition: none; transform: none; }
  .typing span, .mascot-node, .mascot-core, .mic-recording { animation: none; }
}
`

/** Folha construida: `adoptedStyleSheets` nao passa por `style-src`, entao o host pode manter um
 *  CSP sem `'unsafe-inline'`. Uma folha por documento, compartilhada entre instancias do widget. */
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

  // Navegador sem folha construida (Safari < 16.4). O `<style>` so passa onde o host permite
  // inline — e onde nao permite, o widget ja nao teria como se estilizar mesmo.
  const style = document.createElement('style')
  style.textContent = WIDGET_STYLE
  root.append(style)
}
