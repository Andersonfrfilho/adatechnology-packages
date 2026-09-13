/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Versão do desenho, não do pacote. Entra no `input_hash` de toda planta guardada: quem consome o
 * pacote invalida o que tem em cache quando este valor muda.
 *
 * Sobe quando **a mesma entrada passa a produzir outro desenho** — apoio, escora, célula, ordem de
 * varredura, arranjo. Não sobe por API nova, campo novo opcional, correção de tipo ou texto.
 */
export const CARGO_LAYOUT_POLICY_VERSION = '2'
