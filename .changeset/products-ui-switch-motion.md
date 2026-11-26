---
'@adatechnology/products-ui': patch
---

Switch "Produto ativo" do `ProductForm` vira o componente interno `ActiveSwitch`: a cor da trilha agora transiciona em 150 ms ease-out (antes trocava de golpe enquanto o thumb deslizava), o thumb anima só `transform`/borda em vez de `transition-all`, o foco usa `focus-visible` com anel e offset, e `motion-reduce` zera as transições. O checkbox nativo ganha `role="switch"` e `aria-label`. Sem mudança de API.
