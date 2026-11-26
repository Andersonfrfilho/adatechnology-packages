---
'@adatechnology/conversations-ui': patch
---

Chips e botões de filtro do workspace (`cv-workspace-chip`, `cv-workspace-toggle`) transicionam fundo, cor e borda em 150 ms ease-out (antes `transition: all` a 0 s, troca seca), ganham `:focus-visible` com outline e `prefers-reduced-motion: reduce` zera a transição. Só CSS, sem mudança de API.
