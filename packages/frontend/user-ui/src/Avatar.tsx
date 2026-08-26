/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A foto de perfil, com as iniciais como estado normal — e não como erro.
 */

import { useState } from 'react'

export type AvatarProps = {
  readonly name: string
  readonly url?: string
  readonly size?: number
}

const DEFAULT_SIZE = 36

/**
 * Duas iniciais no máximo, do primeiro e do último nome.
 *
 * "Maria da Silva Souza" vira MS, e não MDS: as partículas do meio não distinguem ninguém numa
 * lista, e três letras num círculo de 36px ficam ilegíveis.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, url, size = DEFAULT_SIZE }: AvatarProps) {
  /*
    URL assinada expira. Quando ela vence entre o carregamento da lista e a rolagem até a linha, o
    `<img>` falha — e sem este estado a tela mostraria o ícone de imagem quebrada do navegador, que
    parece defeito. Cair nas iniciais é o mesmo desenho de quem nunca subiu foto.
  */
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size }

  if (!url || broken) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200"
        style={style}
      >
        {initialsOf(name)}
      </span>
    )
  }

  return (
    <img
      // Decorativa: o nome esta na celula ao lado, e um `alt` com o nome faria o leitor de tela
      // anunciar a mesma pessoa duas vezes por linha.
      alt=""
      className="shrink-0 rounded-full object-cover"
      loading="lazy"
      onError={() => setBroken(true)}
      src={url}
      style={style}
    />
  )
}
