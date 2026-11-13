/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Teste contra o zbar DE VERDADE, com um EAN-13 gerado aqui.
 *
 * Existe porque os testes com dublê deixaram passar o defeito mais caro que este pacote teve: os
 * nomes de formato eram invencao ("EAN-13"), o zbar devolve `ZBAR_EAN13`, e o filtro nunca casava.
 * A leitura voltava vazia sempre, sem erro e sem log — e o dublê, que repetia a invencao,
 * confirmava que estava tudo certo.
 *
 * Pulado quando o `@undecaf/zbar-wasm` (peer opcional) nao esta instalado.
 */

import { describe, expect, it } from 'bun:test'

import { createBarcodeReader } from './barcode-reader.service'

const LEFT = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]
const GREEN = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
]
const RIGHT = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
]
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function withChecksum(twelve: string): string {
  const sum = [...twelve].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0)
  return twelve + String((10 - (sum % 10)) % 10)
}

function encode(code: string): string {
  const parity = PARITY[Number(code[0])]!
  let bits = '101'
  for (let i = 0; i < 6; i++) bits += (parity[i] === 'L' ? LEFT : GREEN)[Number(code[1 + i])]!
  bits += '01010'
  for (let i = 0; i < 6; i++) bits += RIGHT[Number(code[7 + i])]!
  return bits + '101'
}

function render(bits: string, moduleWidth = 3, height = 120, quiet = 30) {
  const width = quiet * 2 + bits.length * moduleWidth
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 0; y < height; y++) {
    for (let index = 0; index < bits.length; index++) {
      if (bits[index] !== '1') continue
      for (let dx = 0; dx < moduleWidth; dx++) {
        const offset = (y * width + quiet + index * moduleWidth + dx) * 4
        data[offset] = data[offset + 1] = data[offset + 2] = 0
      }
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData
}

const zbar = await import('@undecaf/zbar-wasm').catch(() => undefined)

describe.if(Boolean(zbar))('zbar de verdade', () => {
  it('decodifica um EAN-13 e devolve o codigo lido', async () => {
    const code = withChecksum('789100010010')
    const reader = createBarcodeReader(
      {},
      {
        loadZbar: async () => zbar as never,
        decodeImage: async () => render(encode(code)),
      },
    )

    const reading = await reader.read({ buffer: Buffer.alloc(0), mimeType: 'image/png' })

    // Se os nomes de formato voltarem a divergir do zbar, isto volta a ser `undefined`.
    expect(reading.barcode).toBe(code)
  })

  it('o typeName que o zbar devolve esta na lista de formatos aceitos', async () => {
    // A asserção direta sobre o vocabulario da biblioteca: e o que impede a lista de virar
    // invencao de novo.
    const symbols = await (zbar as { scanImageData: (i: ImageData) => Promise<{ typeName: string }[]> }).scanImageData(
      render(encode(withChecksum('789100010010'))),
    )

    expect(symbols[0]?.typeName).toBe('ZBAR_EAN13')
  })
})
