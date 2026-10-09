---
'@adatechnology/conversations-ui': patch
---

Corrige a faixa de filtros por assunto (`.cv-p-filters`) e as respostas rápidas (`.cv-p-quick`) cortadas na visão do participante: itens de coluna flex com `overflow` próprio perdiam o `min-height:auto` e encolhiam. Agora usam `flex: 0 0 auto` (busca, compositor, cabeçalho e cartão de assunto da conversa recebem o mesmo, de forma defensiva). Só afeta seletores `.cv-p-*` da visão do participante; nenhum outro fluxo do SDK muda.
