# Publicar o trio de notificações e o de catálogo

**A publicação é do CI.** `.github/workflows/publish.yml` roda no push para `main` e faz
`pnpm changeset version` + `pnpm publish:changesets` com o `NPM_TOKEN` do repositório. Não há
publicação manual, e ninguém precisa de `npm login` local.

Ou seja: **merge para `main` é a publicação.** É o único passo que falta.

## O que sai no próximo merge

Em modo `pre`, o changeset **não é consumido** — os arquivos ficam até o `changeset pre exit`. É
por isso que 57 acumularam, e é por isso que cada merge bumpa `rc+1` de todo pacote com changeset
pendente. Medido com `changeset version` de verdade (revertido depois):

| Pacote | |
|---|---|
| notification-contracts, notification-module, notification-client, notification-ui, push-provider, email-provider | `0.1.0-rc.0` → `rc.1` |
| module-http, catalog-contracts, catalog-module | `0.1.0-rc.0` → `rc.1` |
| meta-whatsapp-module | `0.2.0-rc.16` → `rc.17` |
| meta-whatsapp-contracts | `0.2.0-rc.8` → `rc.9` |
| conversations-ui | `0.1.0-rc.20` → `rc.21` |
| products-ui, audio-transcription-provider | `0.1.0-rc.0` → `rc.1` |

Catorze pacotes, não só os nossos nove. **Isso é o fluxo normal deste repositório**, não um
efeito colateral — os 16 release candidates do `meta-whatsapp-module` chegaram lá exatamente
assim. O conteúdo publicado é o que está commitado; nada em voo de outra sessão vaza, porque o
que não foi commitado não entra no merge.

A única atenção: `products-ui` sai com o conteúdo de `main`, enquanto
`feat/products-price-reference` tem trabalho mais novo ainda não mergeado. Normal — publica o que
está em `main` — mas quem acompanha aquele branch deve saber que um `rc` sai sem as mudanças dele.

## Prontidão para o CI, verificada passo a passo

Rodei localmente o que cada passo do workflow roda:

| Passo do workflow | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ 42 projetos, lockfile consistente |
| `pnpm run build:all` | ✅ exit 0, 79 builds |
| `pnpm changeset version` | ✅ exit 0, só o aviso esperado de prerelease |
| `publishConfig.access: public` nos nove | ✅ todos |

O `access: public` importa mais do que parece: pacote com escopo sai como `restricted` quando o
`package.json` não declara, e o npm responde **404** para quem não tem acesso — o pacote parece
não existir. O passo `Ensure scoped packages are public` do workflow tem uma lista fixa que **não
inclui** os nove novos, e não precisa incluir: eles já declaram `access: public`, e essa lista
existe só para consertar no registry quem foi publicado antes de a declaração existir.

## O que fazer

1. `git push` do branch (feito)
2. Abrir PR e mergear para `main` — **é o merge que publica**
3. Fase 7: apontar o quickcart para o `rc.1` e montar

## Depois de publicar

Fase 7 do `.specs/features/notification-trio/tasks.md`. É lá que a métrica de **≤ 25 linhas de
cola** — a tese do projeto — finalmente é medida, contra as 1.353 linhas atuais. O que a Fase 7
descobrir vira `rc.2`.
