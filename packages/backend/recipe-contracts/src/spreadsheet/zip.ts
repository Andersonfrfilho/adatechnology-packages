/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * ZIP mínimo, só armazenamento (sem compressão): o suficiente para um XLSX, sem dependência.
 */

export type ZipEntry = { readonly name: string; readonly data: Uint8Array }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const UTF8_FLAG = 0x0800
// 1980-01-01 00:00 em formato DOS: data fixa deixa o arquivo determinístico (testável por bytes).
const DOS_DATE = (0 << 9) | (1 << 5) | 1

function header(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size)
  write(new DataView(bytes.buffer))
  return bytes
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length
    const local = header(30, (view) => {
      view.setUint32(0, 0x04034b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, UTF8_FLAG, true)
      view.setUint16(12, DOS_DATE, true)
      view.setUint32(14, crc, true)
      view.setUint32(18, size, true)
      view.setUint32(22, size, true)
      view.setUint16(26, name.length, true)
    })
    const central = header(46, (view) => {
      view.setUint32(0, 0x02014b50, true)
      view.setUint16(4, 20, true)
      view.setUint16(6, 20, true)
      view.setUint16(8, UTF8_FLAG, true)
      view.setUint16(14, DOS_DATE, true)
      view.setUint32(16, crc, true)
      view.setUint32(20, size, true)
      view.setUint32(24, size, true)
      view.setUint16(28, name.length, true)
      view.setUint32(42, offset, true)
    })
    locals.push(local, name, entry.data)
    centrals.push(central, name)
    offset += local.length + name.length + size
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = header(22, (view) => {
    view.setUint32(0, 0x06054b50, true)
    view.setUint16(8, entries.length, true)
    view.setUint16(10, entries.length, true)
    view.setUint32(12, centralSize, true)
    view.setUint32(16, offset, true)
  })
  return concat([...locals, ...centrals, end])
}
