/**
 * Leitura de CSV exportado de planilha: aspas, aspas dobradas e quebra de linha dentro de aspas.
 */

export function parseCSV(text: string): string[][] {
  // Começa com um registro aberto: sem ele, as células da primeira linha (o cabeçalho) se perdiam.
  const rows: string[][] = [[]]
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        rows[rows.length - 1]?.push(current.trim())
        current = ''
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        rows[rows.length - 1]?.push(current.trim())
        rows.push([])
        current = ''
        if (char === '\r') i++
      } else if (char === '\r') {
        rows[rows.length - 1]?.push(current.trim())
        rows.push([])
        current = ''
      } else {
        current += char
      }
    }
  }

  if (current) rows[rows.length - 1]?.push(current.trim())

  return rows.filter((row) => row.some((cell) => cell.length > 0))
}

// Cabeçalho casado sem acento e sem caixa: a mesma planilha sai como "Preço", "preco" e "PREÇO".
const BULK_IMPORT_COLUMN_BY_HEADER: Readonly<Record<string, string>> = {
  name: 'name',
  nome: 'name',
  produto: 'name',
  price: 'price',
  preco: 'price',
  description: 'description',
  descricao: 'description',
  unit: 'unit',
  unidade: 'unit',
  brand: 'brand',
  marca: 'brand',
  barcode: 'barcode',
  'codigo de barras': 'barcode',
  ean: 'barcode',
  catalogname: 'catalogName',
  catalog: 'catalogName',
  catalogo: 'catalogName',
  sectionname: 'sectionName',
  section: 'sectionName',
  secao: 'sectionName',
  inventory: 'inventory',
  estoque: 'inventory',
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * CSV com cabeçalho → linhas no formato da importação em lote do `catalog-module`. Coluna
 * desconhecida é descartada aqui, em vez de subir só para ser recusada linha a linha.
 */
export function parseBulkImportCsv(text: string): Array<Record<string, string>> {
  const [header, ...records] = parseCSV(text)
  if (!header) return []
  const columns = header.map((cell) => BULK_IMPORT_COLUMN_BY_HEADER[normalizeHeader(cell)])

  return records
    .map((cells) => {
      const row: Record<string, string> = {}
      columns.forEach((column, index) => {
        const value = cells[index]
        if (column && value) row[column] = value
      })
      return row
    })
    .filter((row) => Object.keys(row).length > 0)
}
