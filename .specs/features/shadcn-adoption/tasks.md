# SHAD — Tasks

Spec: `.specs/features/shadcn-adoption/spec.md`

Gate ao fim de **cada** task: `pnpm --filter=<pacote> exec tsc --noEmit` + testes do pacote +
**teste de teclado** quando a task toca primitiva interativa + commit isolado
(`model-economy.md` §3).

**O que torna task de `haiku` segura aqui:** cada uma abaixo nomeia o arquivo, o componente do
shadcn a usar, e o critério de aceite verificável. Task sem essas três coisas sobe de modelo.

---

## Fase 0 — Decisões e regra
> 🤖 Modelo: `opus` 🧠

- ✅ **T0.1** Spec escrita, com inventário medido.
- **T0.2** Corrigir o `web.md` §13 com o texto da §7 da spec. **Bloqueia tudo:** sem isso, cada task
      seguinte reabre a discussão de aplicação × pacote.
- **T0.3** Decidir onde os componentes de UI da aplicação moram: `src/components/ui` no painel, ou
      um pacote base novo. **Recomendação:** no painel. Pacote base só se o `frontend-site` também
      precisar, e hoje ele não tem componente interativo.

---

## Fase 1 — Dívida de acessibilidade, sem shadcn
> 🤖 Modelo: `sonnet`

Nada aqui depende de adotar shadcn. É a dívida do §4.1, e é o maior retorno da spec inteira.

- **T1.1** `notification-ui` — `MessageToolbar.tsx`: a paleta de emoji fecha com `Escape`, fecha ao
      clicar fora, prende o foco enquanto aberta e devolve ao botão ao fechar.
      **Aceite:** teste que abre pelo teclado, tecla `Escape`, e verifica `document.activeElement`
      de volta no botão.
- **T1.2** Auditar as outras 10 ocorrências de `aria-expanded` nos pacotes. Produzir a lista de
      quais têm a mesma dívida. **Só a lista** — a correção é T1.3.
      **Aceite:** arquivo `.specs/features/shadcn-adoption/aria-expanded.md` com arquivo, linha e
      quais dos quatro comportamentos faltam em cada.
- **T1.3** Corrigir as da lista de T1.2, uma task por componente.
      > 🤖 `haiku` por item — o padrão já estará provado em T1.1.

---

## Fase 2 — Auditoria dos `<select>`
> 🤖 Modelo: `haiku`

- **T2.1** Listar as 23 ocorrências de `<select>` com a **contagem de opções** e se a lista é
      estática ou vem de dados.
      **Aceite:** `.specs/features/shadcn-adoption/selects.md`, marcando quais violam o `web.md` §11
      (≥8 opções, ou lista que pode crescer).
- **T2.2** Para cada violação, decidir: combobox com busca, ou permanece nativo com justificativa
      escrita no código.
      > 🤖 `sonnet` — é decisão, não passe mecânico.

---

## Fase 3 — shadcn no painel
> 🤖 Modelo: `sonnet`

A aplicação onde ele encaixa. São 1.809 linhas e 24 arquivos: pequeno de propósito, porque o painel
consome tela composta dos pacotes.

- **T3.1** `components.json` no `frontend-panel`, com `cssVariables: true` mapeando os tokens do
      `index.css` (`--color-brand-*`). **Aceite:** um componente do shadcn renderiza com a paleta do
      produto, sem hexadecimal novo.
- **T3.2** Copiar as primitivas que o painel realmente usa: `button`, `input`, `select`, `dialog`,
      `popover`, `table`. **Não copiar o conjunto inteiro** — componente não usado é código morto.
- **T3.3** Migrar `Agents.page.tsx` e `SignIn.page.tsx` para as primitivas copiadas.
      > 🤖 `haiku` por arquivo — o padrão sai de T3.2.
      **Aceite:** visual idêntico ao anterior em 375px, 768px e 1280px (`web.md` §10).

---

## Fase 4 — Primitivas do Radix nos pacotes, só onde há dívida
> 🤖 Modelo: `sonnet`

**Não é migração de pacote.** É trocar a implementação artesanal por Radix nos pontos que a Fase 1
mostrar que continuam frágeis depois da correção manual.

- **T4.1** Decidir, com a lista de T1.2 em mãos, quais componentes valem Radix como dependência.
      **Critério:** só entra o que a correção manual não resolve bem — combobox com busca e diálogo
      modal são os candidatos prováveis; popover simples não é.
- **T4.2** Uma task por componente aprovado em T4.1, com changeset dizendo o custo de dependência.
      > 🤖 `sonnet` — mexe em pacote publicado que três produtos consomem.

---

## Fora de escopo (ver spec §5)

- Migrar `conversations-ui` em bloco (12.575 linhas)
- Componente de domínio: canvas, editor de fluxo, gráfico, player
- `web-chat-widget` — Web Component fora do React
- Tabelas — já têm `aria-sort` e três estados, sem dívida conhecida

## Ordem e paralelismo

```
T0.2 ─┬─> Fase 1 ──> T4.1 ──> T4.2
      ├─> Fase 2
      └─> Fase 3
```

**A Fase 1 é a única que entrega valor sozinha.** Se a adoção do shadcn for adiada, ela continua
valendo — e é a que conserta o que hoje está quebrado para quem usa teclado.
