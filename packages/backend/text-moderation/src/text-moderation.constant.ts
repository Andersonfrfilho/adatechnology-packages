/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/**
 * O dicionário `pt` da lib é tradução automática de uma lista inglesa e não serve: traz `no`,
 * `o quê`, `boa sorte`, `amigos`, `bolo`, `osso` e `sangrento` como ofensivos — "coloca no carrinho
 * por favor" seria acusada. Ele é carregado e imediatamente removido, e só o que está aqui vale.
 * Aproveitamos da lib o motor (fronteira de palavra com acento, whitelist, censura), não os termos.
 */
export const BASE_DICTIONARY_LANGUAGE = 'pt'

/**
 * Núcleo pt-BR. Deliberadamente fora daqui, por serem palavra legítima em contexto de comércio:
 * `pau` (pau de canela), `rola` (verbo), `pinto` (ave), `piranha` (peixe) e `bunda`. Produto que
 * queira barrá-los usa `extraTerms`, assumindo o falso positivo no próprio catálogo.
 */
export const PT_BR_OFFENSIVE_TERMS = [
  'arrombado',
  'babaca',
  'bicha',
  'boquete',
  'bosta',
  'buceta',
  'caralho',
  'corno',
  'cretino',
  'cu',
  'cuzao',
  'cuzão',
  'desgraca',
  'desgraça',
  'escroto',
  'fdp',
  'filho da puta',
  'foda',
  'fodase',
  'foder',
  'fudido',
  'idiota',
  'imbecil',
  'merda',
  'otario',
  'otário',
  'porra',
  'pqp',
  'punheta',
  'puta',
  'putaria',
  'puto',
  'retardado',
  'safado',
  'tarado',
  'trouxa',
  'vagabundo',
  'viado',
  'vsf',
  'xoxota',
] as const

/** Separador da lista que chega por variável de ambiente. */
export const TERM_LIST_SEPARATOR = ','
