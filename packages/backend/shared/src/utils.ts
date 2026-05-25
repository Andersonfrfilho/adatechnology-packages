export function noop() {
  return undefined;
}

export function prefixWith(prefix: string, value: string) {
  return `${prefix}-${value}`;
}
