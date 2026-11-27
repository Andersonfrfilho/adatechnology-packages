/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Seletor segmentado de aparelho (radiogroup): setas, Home e End movem a seleção; só a opção ativa
 * entra na ordem de Tab.
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'

import { nextOptionId } from '../previewDevice.util'

export type PreviewDeviceOption = {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
}

export type PreviewDeviceSwitchProps = {
  readonly label: string
  readonly options: readonly PreviewDeviceOption[]
  readonly value: string
  readonly onChange: (id: string) => void
  readonly className?: string
}

export function PreviewDeviceSwitch({ label, options, value, onChange, className }: PreviewDeviceSwitchProps) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const next = nextOptionId(
      options.map((option) => option.id),
      value,
      event.key,
    )
    if (next === undefined) return
    event.preventDefault()
    onChange(next)
    buttons.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className={clsx('adn-device-switch', className)}>
      {options.map((option) => {
        const isActive = option.id === value
        return (
          <button
            key={option.id}
            ref={(node) => {
              buttons.current[option.id] = node
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className="adn-device-switch__option"
            onClick={() => onChange(option.id)}
            onKeyDown={handleKeyDown}
          >
            <span className="adn-device-switch__icon" aria-hidden="true">
              {option.icon}
            </span>
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
