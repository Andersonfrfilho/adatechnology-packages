---
'@adatechnology/conversations-ui': patch
---

Corrige a faixa de filtros por assunto (`.cv-p-filters`) cortada em listas longas da visão do participante: itens de coluna flex com altura própria (filtros, busca, avisos, cabeçalhos, compositor e respostas rápidas) agora usam `flex: 0 0 auto` e não encolhem. Só afeta seletores `.cv-p-*` da visão do participante; nenhum outro fluxo do SDK muda.
