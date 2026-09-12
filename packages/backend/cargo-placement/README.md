# @adatechnology/cargo-placement

O empacotador do baú do TransportAdA: posiciona caixas por parada numa grade de 5 cm, exige 80 % da
base apoiada e escora lateral, fatia a carga na ordem inversa de entrega e devolve a planta
(`resolveCargoLayout`) e as camadas do plano (`resolveCargoPlanLayers`). Puro, sem dependência de
runtime, pensado para rodar numa thread de worker.

## Contrato

- entrada em milímetros e metros como `string` decimal — nunca float binário;
- `resolveCargoPlacement` devolve `null` quando não há baú, e `layers`/`unplaced` com motivo quando há;
- a nota (`documentId`, `documentNumber`) viaja de carona: nenhuma posição depende dela;
- `resolveCargoLayout` decide o arranjo por parada **uma vez** e tabela e desenho herdam a decisão;
- o serviço decimal (`parseScaledDecimal`, `formatScaledDecimal`, `divideHalfUp`) opera em `bigint`.

```ts
import { resolveCargoLayout, resolveCargoPlacement } from '@adatechnology/cargo-placement'
```

As cargas reais medidas que calibram o empacotador ficam em `@adatechnology/cargo-placement/fixtures`
(`ACCELO_24_STOPS`, `ATEGO_85_STOPS`, `MIXED_BEDS`, `createMixedLoad`). São dados, não regra.

## Orçamento de tempo (`deadline`)

Pensado para rodar numa thread de worker com prazo de relógio: `resolveCargoLayout`,
`resolveCargoPlacement` e `resolveStopArrangement` aceitam um `deadline?: number` opcional (epoch
ms) e um `now?: () => number` opcional (relógio injetável, `Date.now` por padrão — útil para teste
determinístico). Sem `deadline`, nada muda: é o mesmo empacotador de sempre.

Com `deadline`, a varredura confere o prazo a cada caixa/unidade. Quando vence, ela para onde
estiver — o que já foi colocado fica colocado — e devolve todo o resto em `unplaced` com
`reason: 'time_budget'`, nunca descartando caixa silenciosamente (spec 085). A decisão de arranjo
(`resolveStopArrangement`/`gridOrDepth`) é sempre livre de prazo, para dar sempre o mesmo resultado
com ou sem `deadline`.

## Regras que não mudam sem spec

Apoio de 80 % da base, escora só pelo lado, célula de 5 cm e `STABLE_STACK_SLENDERNESS` são decisões
de produto medidas em cargas reais. Mudança nelas nasce numa spec do TransportAdA, com números, antes
de chegar aqui.
