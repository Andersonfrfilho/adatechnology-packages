# SHAD — Adoção do shadcn/ui no ecossistema

- **Data:** 2026-08-25
- **Status:** proposta
- **Regra de origem:** `web.md` §13 — *"Todo componente de interface novo nasce do shadcn/ui"*

## 1. O problema, medido

A regra existe desde sempre e **nunca foi ligada**. Não há `components.json` nem `@radix-ui` em
nenhum repositório: nem no painel, nem em `conversations-ui`, `products-ui`, `notification-ui`,
`user-ui`. Toda a UI é Tailwind escrito à mão.

Inventário real (2026-08-25):

| Onde | Arquivos `.tsx` | Linhas |
|---|---|---|
| `conversations-ui` | 62 | **12.575** |
| `products-ui` | 9 | 2.260 |
| `notification-ui` | 11 | 2.189 |
| `user-ui` | 12 | 863 |
| `apps/frontend-panel` | 24 | 1.809 |
| **total** | **118** | **19.696** |

Primitivas que o shadcn cobriria, por onde estão:

| Primitiva | Painel | Pacotes |
|---|---|---|
| `<select>` nativo | 0 | **23** |
| `aria-expanded` (popover/dropdown) | 0 | **11** |
| `<table>` | 2 | 7 |
| `role="tab"` | 0 | 5 |
| checkbox | 0 | 4 |
| `role="dialog"` | 0 | 2 |

**O fato que decide o plano: 91% da UI está em pacote publicado, não em aplicação.**

## 2. Onde o shadcn encaixa, e onde não

O modelo do shadcn é **copiar o componente para dentro do repositório**, não instalá-lo. Isso é
desenhado para aplicação.

| | Encaixe |
|---|---|
| **Aplicação** (`frontend-panel`, `frontend-site`) | ✅ É o caso de uso do shadcn |
| **Pacote publicado** | ⚠️ Embutir Radix impõe a dependência aos três produtos que consomem, e "copiar para dentro" não faz sentido em algo que se publica |

O próprio §13 já diz que **tela compartilhada manda mais**: ali se consome a tela composta inteira e
se customiza por `labels` e slots, nunca remontando com shadcn por cima.

## 3. Decisão

**Adoção parcial e dirigida por dívida, não migração total.**

1. **Aplicações adotam shadcn.** `components.json`, Radix, componentes em `src/components/ui`.
2. **Pacotes publicados NÃO migram em bloco.** Eles ganham as primitivas do Radix apenas onde há
   dívida de acessibilidade medida — e como dependência declarada, com o custo explícito no
   changeset.
3. **Componente novo em aplicação nasce do shadcn.** Componente novo em pacote segue a regra
   corrigida (§7).

### Por que não migrar tudo

O `web.md` §13 diz: *"Não migrar tela que funciona só para adotar shadcn. Migração é trabalho com
risco e sem ganho visível ao usuário."* Reescrever 12.575 linhas do `conversations-ui` — o motor de
conversa dos três produtos — é semanas de trabalho com risco em tela que funciona, para um ganho que
o usuário não vê.

**O ganho real é concentrado**, e a §4 lista onde.

## 4. A dívida que justifica o trabalho

Ordenada por quanto dói, não por quanto é fácil:

### 4.1 Popover e dropdown sem foco preso — 11 ocorrências

Componentes com `aria-expanded` que abrem conteúdo sem: fechar com `Escape`, fechar ao clicar fora,
prender o foco enquanto aberto, devolver o foco ao fechar.

**Exemplo confirmado:** a paleta de emoji do `notification-ui` (`MessageToolbar.tsx`) não faz
nenhuma das quatro. Quem abre pelo teclado fica preso.

É o item de maior retorno: invisível para quem enxerga e usa mouse, intransponível para quem não.

### 4.2 `<select>` nativo em lista longa — auditar 23 ocorrências

O `web.md` §11 proíbe `<select>` nativo a partir de ~8 opções, ou em qualquer lista que possa
crescer. Nem todas as 23 violam — lista curta e estática é permitida. **Auditar antes de migrar.**

### 4.3 Diálogo sem foco preso — 2 ocorrências

Mesmo problema do §4.1, num componente onde a consequência é maior.

### 4.4 Tabelas — sem dívida conhecida

As do `notification-ui` já têm `aria-sort`, cabeçalho de três estados e zebra por CSS. **Não entram
nesta migração.**

## 5. O que sai desta spec

- `conversations-ui` (12.575 linhas) — só as primitivas do §4, nunca a tela inteira
- Qualquer reescrita de componente de domínio (canvas, editor de fluxo, gráfico, player)
- Web Component fora do React (`web-chat-widget`) — shadcn é React
- Tabelas (§4.4)

## 6. Critérios de aceite

Por fase, e todos verificáveis:

1. `tsc --noEmit` limpo no pacote ou app tocado
2. Testes do pacote passando
3. **Teste de teclado explícito** em cada primitiva migrada: abrir, navegar, `Escape`, foco de volta
4. Nenhum valor arbitrário hardcoded (`web.md` §8) — os componentes copiados do shadcn respeitam os
   tokens via `cssVariables: true`
5. Commit isolado por task, para rollback barato (`model-economy.md` §3)
6. Changeset em toda mudança de pacote publicado, dizendo o custo de dependência

## 7. Correção necessária no `web.md` §13

A regra não distingue aplicação de pacote publicado, e é essa ausência que produziu a dúvida que
originou esta spec. Acrescentar:

> **shadcn é o padrão para componente de APLICAÇÃO.** Em pacote publicado o padrão continua sendo
> Tailwind próprio: o modelo do shadcn é copiar para dentro do repositório, e um pacote que embute
> Radix impõe a dependência a todos os consumidores. Pacote entrega tela composta e slots; quem
> quiser shadcn por cima, compõe no produto. A exceção é dívida de acessibilidade medida — aí a
> primitiva do Radix entra como dependência declarada, com o custo no changeset.

## 8. Riscos

- **Duas linguagens visuais convivendo.** Mitigação: adotar por aplicação inteira, não por tela.
- **Peso de bundle nos pacotes.** Mitigação: só as primitivas do §4, nunca o conjunto.
- **Regressão em tela que funciona.** Mitigação: o §5 tira do escopo tudo que não tem dívida medida.
