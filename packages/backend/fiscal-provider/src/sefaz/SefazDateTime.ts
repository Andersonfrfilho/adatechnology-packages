const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000

// Brasília has no DST since 2019, so -03:00 is always correct — but reading
// wall-clock fields via getFullYear/getHours reflects the *host's* local
// timezone (e.g. UTC in a Docker container), not Brasília's. Shifting the
// epoch first and reading back with getUTC* makes the result host-TZ-proof.
export function toBrasiliaWallClock(date: Date): Date {
  return new Date(date.getTime() - BRASILIA_OFFSET_MS)
}

export function formatDhEmi(date: Date): string {
  const wallClock = toBrasiliaWallClock(date)
  const pad = (value: number) => value.toString().padStart(2, '0')
  const year = wallClock.getUTCFullYear()
  const month = pad(wallClock.getUTCMonth() + 1)
  const day = pad(wallClock.getUTCDate())
  const hours = pad(wallClock.getUTCHours())
  const minutes = pad(wallClock.getUTCMinutes())
  const seconds = pad(wallClock.getUTCSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`
}

/**
 * Timestamp -03:00 para eventos (dhEvento de cancelamento). Mesma base de fuso do dhEmi —
 * usar getHours() da máquina quebra em containers UTC (gera data 3h no futuro → cStat 578).
 */
export function formatSefazDateTime(date: Date): string {
  return formatDhEmi(date)
}
