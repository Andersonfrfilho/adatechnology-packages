/**
 * Junta classes resolvendo conflitos de utilitário do Tailwind.
 *
 * Concatenar não basta: a ordem no atributo `class` não decide nada, quem decide é a ordem no CSS
 * gerado. Com `px-4` na base e `px-2` vindo do host, o Tailwind emite `px-2` antes de `px-4` e a
 * base ganharia — justo o caso de quem quer apertar o espaçamento. O `twMerge` descarta a classe
 * base quando o host manda uma da mesma família, então o override do produto sempre vence.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
