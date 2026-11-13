function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local calendar day as the `datetime` of a `<time>`: the label shows the local day, so must the machine value. */
export function toDateTimeAttribute(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
