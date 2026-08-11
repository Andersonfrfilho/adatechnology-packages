import { Moon, Sun } from 'lucide-react'

import { cn } from './lib/cn'
import { ICON_SIZE_ACTION } from './icon.constant'

export interface DarkModeToggleLabels {
  /** Ação de ir para o tema escuro — é o rótulo lido enquanto o tema claro está ativo. */
  toDark: string
  toLight: string
}

export interface DarkModeToggleClassNames {
  /** O tamanho do ícone vem daqui quando o host usa a própria escala (`size-4`, `size-5`). */
  icon?: string
  label?: string
}

export interface DarkModeToggleProps {
  isDark: boolean
  onToggle: () => void
  /** Rótulo ao lado do ícone. Só-ícone exige a área de toque mínima, que a classe `cv-touch` dá. */
  showLabel?: boolean
  labels?: Partial<DarkModeToggleLabels>
  /**
   * Substitui a aparência do botão. As classes passam por `tailwind-merge`, então utilitário do
   * host vence o do pacote em vez de somar: `px-4` descarta o `px-3` daqui.
   *
   * A exceção é utilitário de token do host (`rounded-panel`), que o merge não reconhece como
   * família e deixa passar junto com o `rounded-lg` do pacote — aí quem decide é a ordem no CSS
   * gerado, não a do atributo. Nesse caso use a forma arbitrária (`rounded-[var(--radius-panel)]`),
   * que o merge entende e substitui.
   */
  className?: string
  classNames?: DarkModeToggleClassNames
}

export const DEFAULT_DARK_MODE_TOGGLE_LABELS: DarkModeToggleLabels = {
  toDark: 'Tema escuro',
  toLight: 'Tema claro',
}

/**
 * Interruptor de tema, apresentacional: o estado vem do host, junto com `useDarkMode`.
 *
 * Ele não monta o hook de propósito. `useDarkMode` é o controlador — escreve a classe `dark` no
 * `<html>` e persiste a escolha —, e uma barra lateral que também existe como gaveta fica montada
 * duas vezes na mesma tela. Dois controladores guardam estados iniciais separados, e o segundo
 * botão passa a mostrar o ícone contrário ao tema que está no ar. Com o estado no host, o hook é
 * chamado uma vez acima dos dois e as duas cópias concordam.
 *
 * O rótulo nomeia o destino, não o estado atual: no claro se lê "Tema escuro", que é o que o clique
 * faz. `aria-pressed` diria o oposto na mesma frase, então fica de fora.
 */
export function DarkModeToggle({
  isDark,
  onToggle,
  showLabel = false,
  labels,
  className,
  classNames,
}: DarkModeToggleProps) {
  const label = isDark
    ? (labels?.toLight ?? DEFAULT_DARK_MODE_TOGGLE_LABELS.toLight)
    : (labels?.toDark ?? DEFAULT_DARK_MODE_TOGGLE_LABELS.toDark)

  const Icon = isDark ? Sun : Moon

  return (
    <button
      type="button"
      onClick={onToggle}
      data-cv-tooltip={showLabel ? undefined : label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors',
        'hover:bg-gray-100 hover:text-gray-900',
        'dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
        !showLabel && 'cv-touch',
        className,
      )}
    >
      {/* Sem `size` quando o host manda classe: a prop vira `width`/`height` no SVG e atributo
          ganha da folha, deixando o ícone fora da escala de tipografia do host. */}
      <Icon
        aria-hidden="true"
        className={cn('shrink-0', classNames?.icon)}
        size={classNames?.icon ? undefined : ICON_SIZE_ACTION}
      />
      {showLabel ? <span className={classNames?.label}>{label}</span> : null}
    </button>
  )
}
