/** Date and time in the reader's locale, as the copy, the export and the info panel write them. */
export function formatMessageMoment(iso: string, locale?: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}
