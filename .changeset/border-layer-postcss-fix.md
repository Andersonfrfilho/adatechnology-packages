---
"@adatechnology/conversations-ui": "patch"
---

Corrige `dist/styles.css` para não depender mais da camada `base` do Tailwind.

O reset de `border-color` (adicionado para o Tailwind v4) usava `@layer base { ... }`.
Qualquer host que importe `@adatechnology/conversations-ui/styles.css` fora do próprio
pipeline do Tailwind — como faz este pacote, que é documentado para não depender de
configuração de Tailwind do host — tinha o build quebrado pelo plugin `postcss` do
Tailwind: ``@layer base` is used but no matching `@tailwind base` directive is present`.

Trocado por seletor `:where(...)`, que zera a especificidade e preserva o mesmo
comportamento (qualquer `border-*` do host ou do pacote continua ganhando), sem
depender de nenhuma camada do Tailwind.
