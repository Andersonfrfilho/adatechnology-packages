import { toDateTimeAttribute } from './participantDay'

export type ParticipantDayDividerProps = {
  readonly day: Date
  readonly locale?: string
}

export function ParticipantDayDivider({ day, locale }: ParticipantDayDividerProps) {
  const label = day.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div className="cv-p-day" role="separator" aria-label={label}>
      <time className="cv-p-day__label" dateTime={toDateTimeAttribute(day)}>
        {label}
      </time>
    </div>
  )
}
