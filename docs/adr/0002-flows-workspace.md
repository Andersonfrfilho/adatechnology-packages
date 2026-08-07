# ADR 0002 — `FlowsWorkspace` precisa de passe próprio, com o financiamento rodando

Status: 🔬 Levantamento concluído, extração **não iniciada** · 2026-08-04

## Contexto

A tabela da skill `adatechnology-ui` marca Fluxograma como 🔴: só peças exportadas, sem
`FlowsWorkspace`, e o financiamento mantém fork local. Depois de fechar o `NotificationsWorkspace` e
o `NotificationSettingsWorkspace`, o passo natural seria repetir a receita aqui.

**Não é a mesma receita.** O levantamento mostra por quê.

## O que foi medido

| | quickcart | financiamento |
|---|---|---|
| Página | 53 linhas | **973 linhas** |
| Cola total | 154 (página + hook + api) | 973 + **1.340 de fork das peças** |
| Importa de | `@adatechnology/conversations-ui/flows` | `@/components/flows/*` — fork de cada peça |
| O que a tela faz | **exibe** o mapa (`onOpenFlow={() => undefined}`) | **edita** o fluxo |

O fork está ATRÁS do pacote, não à frente: o `FlowNodePanel` do pacote tem 453 linhas contra 354 do
fork, e diverge em 247. Migrar o financiamento faz ele ganhar funcionalidade, não perder — mas exige
reconciliar comportamento, não só trocar import.

## Por que não é embrulho de layout

O `NotificationSettingsWorkspace` absorveu layout e uma lista. Este absorveria uma **máquina de
estado de editor**: 13 fatias de estado e 14 handlers, entre eles

- `isFlowDirty`, `dirtyKeys`, `isDirty` — comparação estrutural com o servidor
- `focusFlow`, `closeFlow` — **`window.confirm` de trabalho não salvo** antes de trocar de fluxo
- `mergeFlow`, `autoMergeAll` — fecho transitivo de fluxos referenciados, no mesmo canvas
- `handleDiscardChanges` — descarte com confirmação
- `handlePublish` — `PUT` em lote de todos os fluxos sujos, bloqueado por `errorCount > 0`
- `onNodesChange`, `onNodeDragStop`, `onConnect` — integração com o React Flow
- `handleOrganize` — layout automático

Três desses (`isFlowDirty`, os dois `confirm`, `handleDiscardChanges`) **governam trabalho não
salvo**. Errar ali não dá erro: apaga em silêncio o fluxo que alguém acabou de desenhar.

## Por que não dá para validar aqui

O quickcart **não exercita o editor** — a tela dele é somente leitura. Então migrar o quickcart para o
workspace novo não provaria nada sobre a parte que importa, exatamente como o `rc.1` do
`notification-ui` passou 19 testes e não renderizava: teste que não roda o caminho não prova o
caminho.

O único validador real é o financiamento, com a base e a API dele no ar.

## Decisão

Passe próprio, em três etapas, na ordem do risco:

1. **`useFlowEditor` no `/headless`, com testes.** É estado puro — dá para testar sem navegador, e é
   a parte que não pode estar errada. Os casos que precisam de teste antes de qualquer refatoração:
   fluxo sujo bloqueia troca de foco; descarte volta ao estado do servidor; publish não sai com erro
   de validação; fechar fluxo mesclado não perde edição dos outros.
2. **`FlowsWorkspace`**, a casca, consumindo o hook e as peças do pacote.
3. **Migrar o financiamento** (973 → ~100) com verificação própria, e o quickcart em modo somente
   leitura do mesmo workspace.

## O que NÃO fazer

Extrair a casca antes do hook testado. A tentação é grande porque a casca é a parte visível, mas é o
estado que carrega o risco — e sem teste, a primeira coisa que se descobre é um usuário dizendo que
perdeu o fluxo.

## Resultado

Os passos 2 e 3 foram feitos em paralelo, na #30, enquanto o passo 1 (as operações puras) era escrito
aqui. A casca da #30 ficou — ela é mais completa e é a que os três produtos consomem desde a `rc.26`.

O passo 1 sobreviveu e foi ligado nela: `flowEditorOps`, com 23 testes, é o que o `FlowsWorkspace`
agora usa para resolver e aplicar conexão, apagar nó e calcular o fecho transitivo dos fluxos abertos.
Duas decisões estavam erradas, e as duas do jeito previsto neste ADR — sem erro, sem log, com o
sintoma aparecendo longe de quem editou:

- aresta emitida para destino vazio, que faz a opção parecer ligada sem estar;
- posição gravada com um deslocamento que o layout mesclado já havia ignorado.

O aviso do "o que NÃO fazer" se confirmou pelo avesso: a casca saiu primeiro, e o que estava errado
era exatamente o estado. O que ela não tem ainda é decomposição — são 1254 linhas num arquivo, e o
canvas (arestas, layout mesclado, contagem ao vivo) segue sem teste porque essas três funções estão
acopladas ao `offset` por fluxo aberto, cuja remoção exige reescrever o componente.

**Feito.** O canvas saiu para `flowCanvasModel`, com 24 testes e três asserções validadas por
mutação. O que o prendia era o `offset` por fluxo aberto: um valor que o layout mesclado ignorava ao
desenhar e que ainda era subtraído ao gravar, então a posição que ia para o grafo nunca tinha sido a
do card. Removê-lo destravou a extração e corrigiu o defeito no mesmo movimento.

O componente ficou com 1006 linhas. A regra valeu: nada foi exportado sem a tela consumir.
