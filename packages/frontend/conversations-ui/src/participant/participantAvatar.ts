const NAME_PARTICLES = new Set([
  'a',
  'e',
  'o',
  'da',
  'das',
  'de',
  'del',
  'di',
  'do',
  'dos',
  'du',
  'la',
  'le',
  'van',
  'von',
])

export type ParticipantAvatarAuthor = string | null

export type ShouldShowAvatarParams = {
  /** Author of the previous message; undefined at the start of the list or right after an own message. */
  readonly previousAuthor: ParticipantAvatarAuthor | undefined
  readonly author: ParticipantAvatarAuthor
  readonly isMine: boolean
}

function lettersOf(word: string): string {
  return word.replace(/[^\p{L}\p{M}]/gu, '')
}

function firstLetter(word: string): string {
  return (Array.from(word.normalize('NFC'))[0] ?? '').toUpperCase()
}

/** Up to two initials; undefined when the name has no letters, so the caller draws the neutral icon. */
export function authorInitials(name: string | null | undefined): string | undefined {
  const [first, ...rest] = (name ?? '').split(/\s+/).map(lettersOf).filter(Boolean)
  if (first === undefined) return undefined
  const last = rest.filter((word) => !NAME_PARTICLES.has(word.toLowerCase())).pop()
  return `${firstLetter(first)}${last === undefined ? '' : firstLetter(last)}`
}

export function shouldShowAvatar({ previousAuthor, author, isMine }: ShouldShowAvatarParams): boolean {
  if (isMine) return false
  if (previousAuthor === undefined) return true
  return previousAuthor !== author
}
