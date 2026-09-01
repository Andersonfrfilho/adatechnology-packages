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
} as const
