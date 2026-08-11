# @adatechnology/web-chat-widget

Chat de site como **Web Component nativo**. Sem React, sem framework, sem CSS global: o elemento
monta em shadow DOM fechado e não vaza estilo para a página do host — que é o requisito real quando
o widget vai enxertado numa landing que não é nossa.

```bash
pnpm add @adatechnology/web-chat-widget
```

```ts
import { API_BASE_ATTRIBUTE, WIDGET_TAG_NAME } from '@adatechnology/web-chat-widget';

const widget = document.createElement(WIDGET_TAG_NAME);
widget.setAttribute(API_BASE_ATTRIBUTE, environment.apiBaseUrl);
document.body.append(widget);
```

Importar o pacote já registra o elemento (`registerAdaChatWidget()` roda no import e é idempotente,
para HMR e duplo carregamento não derrubarem a página). O atributo de base da API é obrigatório: a
origem muda por ambiente e o servidor confere o `Origin`, então domínio chutado no código vira erro
de CORS silencioso em produção.

## O que ele faz

- Bolhas agrupadas por janela de tempo, com rabinho, divisor de data, horário e recibo de entrega
- Marcação `*negrito*` / `_itálico_` renderizada por `createElement`, **nunca** `innerHTML` — o texto
  vem do editor de fluxo, que é entrada de usuário
- Botões de resposta rápida a partir das opções do nó corrente
- `autocomplete` / `inputMode` do campo de texto guiados pelo `answerKind` que a API carimba
- Nota de voz por `MediaRecorder`, transcrita no servidor
- Tema claro/escuro pelo sistema, `prefers-reduced-motion` respeitado, mascote embutido em SVG

## Capacidade por ausência

O microfone só aparece quando o navegador suporta `MediaRecorder` **e** a rota de áudio responde.
Não há flag `hasAudio`: ausência de capacidade é ausência de affordance.

## O contrato HTTP que o host precisa servir

Este pacote é **só a metade do cliente**. Ele fala com quatro rotas, e o produto que o consome
precisa servi-las (hoje elas vivem no `api-ada`; quando houver segundo consumidor de backend, viram
um `web-chat-module`):

| Rota | O que faz |
|---|---|
| `POST /v1/widget/sessions` | Abre a conversa; devolve `{ data: { sessionId } }` |
| `GET /v1/widget/sessions/:id/messages?limit=` | Transcript; o último balão do bot carrega `payload.options` e `payload.answerKind` |
| `POST /v1/widget/sessions/:id/messages` | Fala do visitante (`{ text }`); devolve `{ data: { outcome } }` |
| `POST /v1/widget/sessions/:id/audio` | Nota de voz em multipart, campo `audio` |
| `GET /v1/widget/sessions/:id/events` | SSE; só avisa que mudou, quem lê é o transcript |

Sucesso responde `{ data }`; erro responde `{ error: { code, message } }`. O widget escolhe a frase
de falha pelo `code` — `CHANNEL_WIDGET_AUDIO_BUSY` e `RATE_LIMITED` pedem espera (com o header
`Retry-After`), `CHANNEL_WIDGET_AUDIO_UNAVAILABLE` e `..._FAILED` convidam a escrever,
`..._NOT_UNDERSTOOD` pede que repita. Status HTTP é só a rede para resposta de proxy sem corpo nosso.

## Ainda não parametrizado

Textos (`widget.locale.json`), cores e o mascote são fixos no bundle. O primeiro consumidor fora da
Ada Technology é o que justifica abrir `locale` e `theme` como portas — antes disso seria abstração
sem consumidor.
