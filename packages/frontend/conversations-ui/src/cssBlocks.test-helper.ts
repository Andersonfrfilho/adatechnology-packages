export type CssBlock = { readonly prelude: string; readonly body: string | undefined }

export function splitBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = []
  let depth = 0
  let start = 0
  let bodyStart = 0
  let prelude = ''
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index]
    if (depth === 0 && char === ';') {
      blocks.push({ prelude: css.slice(start, index).trim(), body: undefined })
      start = index + 1
    }
    if (char === '{') {
      if (depth === 0) {
        prelude = css.slice(start, index).trim()
        bodyStart = index + 1
      }
      depth += 1
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        blocks.push({ prelude, body: css.slice(bodyStart, index) })
        start = index + 1
      }
    }
  }
  return blocks
}
