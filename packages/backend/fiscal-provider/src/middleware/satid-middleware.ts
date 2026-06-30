/**
 * S@T-iD Middleware HTTP
 * Wrapper para libsatid.so.1.3.5 (Control-ID)
 * Expõe API HTTP compatível com fiscal-provider
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'
import { dlopen, FFIType, read } from 'bun:ffi'
import * as fs from 'fs'
import * as path from 'path'

// Caminho da biblioteca nativa
const LIB_PATH = '/home/miyazaki/Downloads/SAT_v1.3.6/linux-x64/libsatid.so.1.3.5'

interface SATConfig {
  activationCode: string
  satUrl?: string
}

class SATiDMiddleware {
  private libsatid: any
  private config: SATConfig

  constructor(config: SATConfig) {
    this.config = config

    // Carregar biblioteca nativa
    if (!fs.existsSync(LIB_PATH)) {
      throw new Error(`Biblioteca SAT não encontrada: ${LIB_PATH}`)
    }

    try {
      // Carregar libsatid.so
      this.libsatid = dlopen(LIB_PATH, {
        // Função: int SAT_ConsultarSAT(const char *codigoDeAtivacao)
        ConsultarSAT: {
          args: ['cstring'],
          returns: FFIType.int32,
        },
        // Função: int SAT_ComunicarUnsignedSaleData(const char *codigoDeAtivacao, const char *numeroSessao, const char *dadosVenda, char *xmlRetorno, int tamanhoXmlRetorno)
        ComunicarUnsignedSaleData: {
          args: ['cstring', 'cstring', 'cstring', 'pointer', FFIType.int32],
          returns: FFIType.int32,
        },
        // Função: int SAT_CancelarUltimaVenda(const char *codigoDeAtivacao, const char *numeroSessao, const char *chaveEnvio, const char *justificativa, char *xmlRetorno, int tamanhoXmlRetorno)
        CancelarUltimaVenda: {
          args: ['cstring', 'cstring', 'cstring', 'cstring', 'pointer', FFIType.int32],
          returns: FFIType.int32,
        },
      })

      console.log('✅ Biblioteca SAT carregada com sucesso')
    } catch (error) {
      throw new Error(`Erro ao carregar libsatid.so: ${error}`)
    }
  }

  /**
   * Consultar status do SAT
   */
  async consultarSAT(): Promise<any> {
    try {
      const result = this.libsatid.symbols.ConsultarSAT(this.config.activationCode)

      return {
        EEEEE: this.formatErrorCode(result),
        mensagem: this.getErrorMessage(result),
        men_sefaz: 'Status consultado com sucesso',
      }
    } catch (error) {
      return {
        EEEEE: '99999',
        mensagem: `Erro ao consultar SAT: ${error}`,
        men_sefaz: 'Erro interno',
      }
    }
  }

  /**
   * Emitir cupom fiscal
   */
  async comunicarUnsignedSaleData(
    numeroSessao: string,
    dadosVenda: string
  ): Promise<any> {
    try {
      // Buffer para retorno XML (máximo 10KB)
      const bufferSize = 10240
      const xmlBuffer = new Uint8Array(bufferSize)

      const result = this.libsatid.symbols.ComunicarUnsignedSaleData(
        this.config.activationCode,
        numeroSessao,
        dadosVenda,
        xmlBuffer,
        bufferSize
      )

      const xmlRetorno = this.bufferToString(xmlBuffer)

      return {
        EEEEE: this.formatErrorCode(result),
        mensagem: this.getErrorMessage(result),
        xml_retorno: xmlRetorno,
        numero_sessao: numeroSessao,
      }
    } catch (error) {
      return {
        EEEEE: '99999',
        mensagem: `Erro ao emitir cupom: ${error}`,
        xml_retorno: '',
      }
    }
  }

  /**
   * Cancelar última venda
   */
  async cancelarUltimaVenda(
    numeroSessao: string,
    chaveEnvio: string,
    justificativa: string
  ): Promise<any> {
    try {
      const bufferSize = 10240
      const xmlBuffer = new Uint8Array(bufferSize)

      const result = this.libsatid.symbols.CancelarUltimaVenda(
        this.config.activationCode,
        numeroSessao,
        chaveEnvio,
        justificativa,
        xmlBuffer,
        bufferSize
      )

      const xmlRetorno = this.bufferToString(xmlBuffer)

      return {
        EEEEE: this.formatErrorCode(result),
        mensagem: this.getErrorMessage(result),
        xml_retorno: xmlRetorno,
      }
    } catch (error) {
      return {
        EEEEE: '99999',
        mensagem: `Erro ao cancelar venda: ${error}`,
        xml_retorno: '',
      }
    }
  }

  /**
   * Formatar código de erro
   */
  private formatErrorCode(code: number): string {
    return String(code).padStart(5, '0')
  }

  /**
   * Obter mensagem de erro
   */
  private getErrorMessage(code: number): string {
    const messages: Record<number, string> = {
      6000: 'SAT respondeu OK',
      3000: 'Erro: Código de ativação inválido',
      8000: 'Erro: Assinatura AC inválida',
      5000: 'Erro: SAT em manutenção',
      99999: 'Erro interno',
    }

    return messages[code] || `SAT retornou código ${code}`
  }

  /**
   * Converter buffer para string
   */
  private bufferToString(buffer: Uint8Array): string {
    const view = new DataView(buffer.buffer)
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(buffer).split('\0')[0] // Remover null terminator
  }
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * Servidor HTTP
 */
function createHTTPServer(middleware: SATiDMiddleware, port: number = 8080) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname
    const searchParams = url.searchParams

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    try {
      // POST /SAT/ConsultarSAT
      if (pathname === '/SAT/ConsultarSAT' && req.method === 'POST') {
        const result = await middleware.consultarSAT()
        res.writeHead(200)
        res.end(JSON.stringify(result))
        return
      }

      // POST /SAT/ComunicarUnsignedSaleData
      if (pathname === '/SAT/ComunicarUnsignedSaleData' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })
        req.on('end', async () => {
          const params = new URLSearchParams(body)
          const numeroSessao = params.get('numeroSessao') || ''
          const dadosVenda = params.get('dadosVenda') || ''

          const result = await middleware.comunicarUnsignedSaleData(numeroSessao, dadosVenda)
          res.writeHead(200)
          res.end(JSON.stringify(result))
        })
        return
      }

      // POST /SAT/CancelarUltimaVenda
      if (pathname === '/SAT/CancelarUltimaVenda' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })
        req.on('end', async () => {
          const params = new URLSearchParams(body)
          const numeroSessao = params.get('numeroSessao') || ''
          const chaveEnvio = params.get('chaveEnvio') || ''
          const justificativa = params.get('justificativa') || ''

          const result = await middleware.cancelarUltimaVenda(numeroSessao, chaveEnvio, justificativa)
          res.writeHead(200)
          res.end(JSON.stringify(result))
        })
        return
      }

      // 404
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Rota não encontrada' }))
    } catch (error) {
      res.writeHead(500)
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Erro interno',
        })
      )
    }
  })

  server.listen(port, () => {
    console.log(`🚀 Middleware S@T-iD rodando em http://localhost:${port}`)
  })

  return server
}

// ────────────────────────────────────────────────────────────────────────────

// Main
if (import.meta.main) {
  const activationCode = process.env.FISCAL_SAT_ACTIVATION_CODE || '123456'
  const port = parseInt(process.env.SAT_MIDDLEWARE_PORT || '8080')

  const middleware = new SATiDMiddleware({ activationCode })
  createHTTPServer(middleware, port)
}

export { SATiDMiddleware, createHTTPServer }
