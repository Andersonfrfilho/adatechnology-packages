/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * Por onde o veículo carrega — decide se a ordem de carregamento é camisa de força.
 *
 * ⚠️ Não se deduz do tipo do veículo: a mesma Sprinter existe com e sem porta lateral. Quem semeia o
 * valor e o comprimento máximo da coluna fica na aplicação; aqui só vive o vocabulário que o
 * empacotador entende.
 */
export const LOADING_ACCESS_KINDS = [
  /** Só a porta traseira: a última entrega viaja no fundo, e a ordem é obrigatória. */
  'rear',
  /** Traseira e lateral: a ordem ainda ajuda, mas dá para alcançar o meio da carga. */
  'rear_and_side',
  /** Carroceria aberta ou sider: a ordem quase não importa; o que passa a valer é o peso. */
  'open',
] as const

export type LoadingAccess = (typeof LOADING_ACCESS_KINDS)[number]
