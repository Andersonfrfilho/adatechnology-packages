---
'@adatechnology/conversations-ui': patch
---

A tabela de Documentos ganha superfície própria, e `border` volta a ser cinza em host Tailwind v4.

- **Borda padrão.** O Tailwind v4 trocou o padrão de `border-color` de `gray-200` por
  `currentColor`, e os componentes daqui foram escritos no v3. Produto que traz a base do shadcn
  nunca viu — ela redefine isso; produto sem shadcn recebia **toda** régua na cor do texto, e a
  tabela de documentos saía com linha azul-quase-preta. O `styles.css` agora declara o padrão na
  camada `base`, via `--cv-border-color`: qualquer `border-*` explícito continua ganhando, e o
  produto troca a cor sem editar o pacote.
- **`.cv-table` e `.cv-table-card`.** Moldura, cabeçalho, régua entre linhas, zebra e realce no
  hover — o que `web.md` §7 pede de toda tela tabular — no stylesheet, como o resto das `.cv-*`,
  para não depender de o host varrer `node_modules` com `@source`. Disponíveis para as demais telas
  tabulares do pacote.
- **Coluna de tipo.** Mostrava o MIME cru: um `.docx` responde
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` e, numa célula sem
  quebra, esticava a coluna a 556px e espremia todas as outras. Passa a usar o mesmo
  `documentTypeLabel` da bolha de documento — `DOCX` numa etiqueta de 109px, com o MIME inteiro na
  dica.
- Tamanho, origem e data deixam de quebrar linha; busca e filtros de data declaram a cor da borda.
