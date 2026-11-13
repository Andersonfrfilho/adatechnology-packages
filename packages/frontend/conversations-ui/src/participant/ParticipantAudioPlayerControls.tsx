import { Pause, Play } from 'lucide-react'
import type { KeyboardEventHandler } from 'react'

type AudioToggleButtonProps = {
  readonly label: string
  readonly isPlaying: boolean
  readonly isPending: boolean
  readonly isDisabled: boolean
  readonly onToggle: () => void
}

export function AudioToggleButton({ label, isPlaying, isPending, isDisabled, onToggle }: AudioToggleButtonProps) {
  return (
    <button
      type="button"
      className="cv-p-audio__toggle"
      aria-label={label}
      data-cv-tooltip={label}
      aria-busy={isPending ? true : undefined}
      disabled={isDisabled}
      onClick={onToggle}
    >
      {isPlaying ? <Pause size={20} aria-hidden="true" focusable="false" /> : <Play size={20} aria-hidden="true" focusable="false" />}
    </button>
  )
}

type AudioSeekRangeProps = {
  readonly label: string
  readonly max: number
  readonly position: number
  readonly valueText: string
  readonly isDisabled: boolean
  readonly onSeek: (seconds: number) => void
  readonly onKeyDown: KeyboardEventHandler<HTMLInputElement>
}

export function AudioSeekRange({ label, max, position, valueText, isDisabled, onSeek, onKeyDown }: AudioSeekRangeProps) {
  return (
    <input
      type="range"
      className="cv-p-audio__seek"
      aria-label={label}
      min={0}
      max={max}
      step={1}
      value={Math.min(position, max)}
      aria-valuetext={valueText}
      disabled={isDisabled}
      onChange={(event) => onSeek(Number(event.currentTarget.value))}
      onKeyDown={onKeyDown}
    />
  )
}

type AudioRateButtonProps = {
  readonly label: string
  readonly text: string
  readonly onClick: () => void
}

export function AudioRateButton({ label, text, onClick }: AudioRateButtonProps) {
  return (
    <button type="button" className="cv-p-audio__rate" aria-label={label} onClick={onClick}>
      {text}
    </button>
  )
}
