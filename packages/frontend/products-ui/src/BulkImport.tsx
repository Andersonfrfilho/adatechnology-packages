import { useState, useCallback, useRef, type ChangeEvent } from 'react'
import type { BulkImportResult } from './providers/types'

export type BulkImportProps = {
  readonly onImport: (file: File) => Promise<BulkImportResult>
}

type PreviewRow = {
  row: number
  cells: string[]
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
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

  if (current) {
    if (rows.length === 0) rows.push([])
    rows[rows.length - 1]?.push(current.trim())
  }

  return rows.filter((row) => row.some((cell) => cell.length > 0))
}

export function BulkImport({ onImport }: BulkImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.name.endsWith('.csv')) {
      setError('Apenas arquivos .csv são aceitos')
      return
    }

    setFile(selected)
    setResult(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const rows = parseCSV(text)
        const previewRows = rows.slice(0, 5).map((cells, index) => ({
          row: index + 1,
          cells,
        }))
        setPreview(previewRows)
      } catch {
        setError('Erro ao ler o arquivo CSV')
      }
    }
    reader.onerror = () => {
      setError('Erro ao ler o arquivo')
    }
    reader.readAsText(selected)
  }, [])

  const handleImport = useCallback(async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const importResult = await onImport(file)
      setResult(importResult)
    } catch {
      setError('Erro ao importar produtos')
    } finally {
      setImporting(false)
    }
  }, [file, onImport])

  const handleReset = useCallback(() => {
    setFile(null)
    setPreview([])
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {result && (
        <div className={`mb-4 p-4 rounded-lg border ${
          result.failed === 0
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h4 className="text-sm font-semibold mb-2">
            {result.failed === 0 ? 'Importação concluída!' : 'Importação concluída com erros'}
          </h4>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-green-700 font-semibold">{result.succeeded}</span>
              <span className="text-gray-600 ml-1">sucesso</span>
            </div>
            <div>
              <span className="text-red-600 font-semibold">{result.failed}</span>
              <span className="text-gray-600 ml-1">falhas</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                  Linha {err.row}: {err.message}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-800"
          >
            Importar outro arquivo
          </button>
        </div>
      )}

      {!result && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo CSV
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              Colunas esperadas: nome, preço, descrição, unidade, código_barras, catálogo, estoque
            </p>
          </div>

          {preview.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Prévia ({preview.length === 5 ? 'primeiras 5' : preview.length} linha{preview.length !== 1 ? 's' : ''})
              </h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                      {preview[0]?.cells.map((_, i) => (
                        <th key={i} className="px-3 py-2 text-left text-gray-500 font-medium">
                          Col {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row) => (
                      <tr key={row.row}>
                        <td className="px-3 py-2 text-gray-400">{row.row}</td>
                        {row.cells.map((cell, i) => (
                          <td key={i} className="px-3 py-2 text-gray-700 max-w-[180px] truncate">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {file && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importando...' : `Importar ${file.name}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
