---
'@adatechnology/user-ui': patch
---

Switch "ativo" do `TeamWorkspace`: o thumb passa a mover por `transform` (`translate-x-5`, `transition-transform`) em vez de animar `left` (layout), a cor da trilha transiciona em 150 ms ease-out, ganha foco visível (`focus-visible:ring-2`) e `motion-reduce:transition-none`. `role="switch"` e `aria-checked` já estavam corretos. Sem mudança de API.
