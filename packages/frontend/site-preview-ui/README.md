# @adatechnology/site-preview-ui

Prévia ao vivo do site dentro do painel que o edita. Dois lados que conversam por `postMessage`:

- **Painel (host):** `SitePreview` desenha o iframe em escala, com **Computador / Tablet / Celular**, zoom, "Ajustar", **mão**
  (arrastar), **Expandir** (formulário e prévia lado a lado, o layout é do host) e tela cheia. A coluna é fixa (`spv-sticky`)
  enquanto o formulário rola.
- **Site (guest, sem React):** `createPreviewGuest` recebe o rascunho, **destaca a seção em edição e rola até ela**, e devolve
  a rolagem depois de recarregar.

## Instalação

```bash
bun add @adatechnology/site-preview-ui
```

```ts
import '@adatechnology/site-preview-ui/styles.css'
```

## Painel

```tsx
import { SitePreview } from '@adatechnology/site-preview-ui'

<SitePreview
  src="/?preview=1"            // rota do site, no mesmo domínio do painel
  payload={draft}              // o que o site deve mostrar no lugar do dado salvo (use useMemo)
  focus={focusedSectionKey}    // chave da seção em edição, ex.: 'photos.gallery'
  refreshKey={photosVersion}   // muda quando algo salvo no servidor mudou (foto): o site recarrega os dados
  storageKey="site-page"       // uma chave por tela: a rolagem sobrevive a trocar de aba e a recarregar
  openUrl="/"
  isSplit={isSplit} onToggleSplit={toggleSplit} divider={<MeuSeparador />}   // opcionais (Expandir)
  renderTooltip={(text, trigger) => <Tooltip text={text}>{trigger}</Tooltip>} // opcional
/>
```

Quem quer outra moldura usa `useSitePreviewChannel({ frameRef, payload, focus, refreshKey, storageKey })` e desenha o iframe.
Tema por custom properties `--spv-*` (`--spv-accent`, `--spv-surface`, `--spv-border`, `--spv-sticky-offset`...).

Cada campo ou bloco do formulário leva `data-preview-field="chave"`; o painel manda a chave de quem tem o foco.

## Site

```ts
import { createPreviewGuest } from '@adatechnology/site-preview-ui/guest'

const guest = createPreviewGuest({
  onState: (draft) => applyDraft(draft),   // valida o formato aqui: vem do painel
  onRefresh: () => reloadSiteData(),       // sem recarregar a página, a rolagem fica
})
guest.start()                              // só age dentro de um iframe do mesmo domínio
```

- Marque as seções com `data-preview-field="chave"` (a mesma chave do painel) ou use `guest.registerSection(chave, elemento)`.
  A chave pode ter mais de um elemento; vale o primeiro visível. **Cada área editável tem a própria chave** (`photos.hero`,
  `photos.gallery`): chave repetida leva sempre ao primeiro elemento.
- `guest.focus(chave)` destaca (`.preview-active`) e rola só se a seção não couber inteira na janela; `guest.flash(chave)`
  pisca o que acabou de mudar (`.preview-flash`). As classes e o atributo são opções.
- Rolagem: o guest informa a posição ao painel (limitada a um quadro) e, depois de recarregar, volta a ela quando a página
  já tem altura; qualquer rolagem do usuário cancela a volta. Sem foco e sem posição guardada, nada rola.
- Segurança: só mensagens da janela pai, do mesmo domínio e do mesmo canal; o que não tem o formato esperado é descartado.

## Protocolo (versão 1)

| De | Mensagem | Efeito |
|---|---|---|
| painel | `state { payload }` | `onState(payload)` |
| painel | `focus { key }` | destaca e rola até a seção |
| painel | `refresh` | `onRefresh()` |
| painel | `restore-scroll { top }` | volta à posição guardada |
| site | `ready` | o painel manda a posição, o rascunho e o foco |
| site | `scroll { top }` | o painel guarda (`sessionStorage`) |
