/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const VISION = {
  /**
   * Quantos candidatos a busca vetorial traz. Cinco porque é o teto do que cabe numa lista do
   * WhatsApp sem virar rolagem, e o que um modelo de visão consegue desempatar numa chamada só.
   */
  CANDIDATE_LIMIT: 5,
  /**
   * Abaixo disto o vizinho mais próximo não é candidato, é ruído. Sem um piso, uma foto de algo
   * que a loja não vende sempre devolve os cinco itens menos improváveis do catálogo — e o
   * cliente lê isso como "o bot não me entendeu", que é pior que "não encontrei".
   */
  MIN_SCORE: 0.6,
  /**
   * Produtos por lote de indexacao. Cada um custa um download do bucket e uma inferencia de CPU:
   * lote grande prende o worker, e lote pequeno multiplica ida e volta ao banco.
   */
  INDEX_BATCH_SIZE: 50,
  /**
   * `hnsw.ef_search` da busca. O default do pgvector e 40, e ele nao conhece o filtro de empresa:
   * o indice acha os N vizinhos do INDICE INTEIRO e o Postgres descarta depois os de outra
   * empresa, entao a busca devolve menos candidatos do que pediu — sem erro nenhum.
   *
   * Medido num indice de 12 mil vetores e 3 empresas: pedindo 20 vizinhos, uma empresa recebia 11.
   * Com 100 o recall volta a ser completo; 200 e o dobro disso, de margem para bases com mais
   * empresas, e ainda custa poucos milissegundos.
   */
  HNSW_EF_SEARCH: 200,
} as const
