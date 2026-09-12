---
'@adatechnology/cargo-placement': minor
---

O empacotador aceita um `deadline` (epoch ms) e um relógio `now` injetável em `resolveCargoLayout`,
`resolveCargoPlacement` e `resolveStopArrangement`: vencido o prazo, a varredura para onde estiver e
devolve o resto como `unplaced` com `reason: 'time_budget'`, sem descartar caixa nenhuma. Sem
`deadline`, o comportamento é idêntico ao de hoje.
