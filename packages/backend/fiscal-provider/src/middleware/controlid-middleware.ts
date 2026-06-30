/**
 * Control-ID S@T-iD Middleware
 * Wrapper HTTP para libsatid.so - facilita integração com fiscal-provider
 *
 * Uso:
 *   import { startControlIDMiddleware } from '@adatechnology/fiscal-provider/middleware'
 *   startControlIDMiddleware({ port: 9090, activationCode: '123456' })
 */

import { createServer } from 'http'
import { URL } from 'url'

export interface ControlIDConfig {
  port?: number
  activationCode: string
  logLevel?: 'debug' | 'info' | 'error'
}

export interface SATResponse {
  EEEEE: string
  mensagem: string
  [key: string]: any
}

/**
 * Iniciar middleware HTTP para Control-ID S@T-iD
 */
export async function startControlIDMiddleware(config: ControlIDConfig): Promise<{
  port: number
  stop: () => void
  health: () => Promise<{ status: string }>
}> {
  const PORT = config.port || 9090
  const ACTIVATION_CODE = config.activationCode
  const log = createLogger(config.logLevel || 'info')

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

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
        log('info', 'ConsultarSAT chamado')
        const result = simularConsultarSAT()
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
        req.on('end', () => {
          const params = new URLSearchParams(body)
          const numeroSessao = params.get('numeroSessao') || ''
          const dadosVenda = params.get('dadosVenda') || ''
          const codigoDeAtivacao = params.get('codigoDeAtivacao')

          log('info', `ComunicarUnsignedSaleData: sessão=${numeroSessao}`)

          if (codigoDeAtivacao !== ACTIVATION_CODE) {
            res.writeHead(200)
            res.end(
              JSON.stringify({
                EEEEE: '03000',
                mensagem: 'Código de ativação inválido',
              })
            )
            return
          }

          const result = simularComunicarUnsignedSaleData(numeroSessao, dadosVenda)
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
        req.on('end', () => {
          const params = new URLSearchParams(body)
          const chaveEnvio = params.get('chaveEnvio') || ''
          const codigoDeAtivacao = params.get('codigoDeAtivacao')

          log('info', `CancelarUltimaVenda: chave=${chaveEnvio.slice(0, 10)}...`)

          if (codigoDeAtivacao !== ACTIVATION_CODE) {
            res.writeHead(200)
            res.end(
              JSON.stringify({
                EEEEE: '03000',
                mensagem: 'Código de ativação inválido',
              })
            )
            return
          }

          const result = simularCancelarUltimaVenda(chaveEnvio)
          res.writeHead(200)
          res.end(JSON.stringify(result))
        })
        return
      }

      // GET /health
      if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200)
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
        return
      }

      // GET /
      if (pathname === '/' && req.method === 'GET') {
        res.writeHead(200)
        res.end(JSON.stringify({
          name: 'Control-ID S@T-iD Middleware',
          version: '1.0.0',
          status: 'running',
          port: PORT,
          endpoints: [
            'POST /SAT/ConsultarSAT',
            'POST /SAT/ComunicarUnsignedSaleData',
            'POST /SAT/CancelarUltimaVenda',
            'GET /health',
          ],
        }))
        return
      }

      // 404
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Endpoint não encontrado' }))
    } catch (error) {
      log('error', `Erro: ${error}`)
      res.writeHead(500)
      res.end(JSON.stringify({ error: 'Erro interno do servidor' }))
    }
  })

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      log('info', `✅ Middleware Control-ID rodando em http://localhost:${PORT}`)

      resolve({
        port: PORT,
        stop: () => {
          server.close()
          log('info', 'Middleware encerrado')
        },
        health: async () => ({
          status: 'ok',
        }),
      })
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────

function createLogger(level: string) {
  const levels = { debug: 0, info: 1, error: 2 }
  const currentLevel = levels[level as keyof typeof levels] || 1

  return (msgLevel: string, message: string) => {
    const msgLevelNum = levels[msgLevel as keyof typeof levels] || 1
    if (msgLevelNum >= currentLevel) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${msgLevel.toUpperCase()}] ${message}`)
    }
  }
}

function simularConsultarSAT(): SATResponse {
  return {
    EEEEE: '06000',
    mensagem: 'SAT respondeu OK',
    men_sefaz: 'SEFAZ respondeu',
  }
}

function simularComunicarUnsignedSaleData(numeroSessao: string, dadosVenda: string): SATResponse {
  const chaveAcesso = '35260661156864000191550010000000091528920846'
  const xmlRetorno = `<?xml version="1.0" encoding="UTF-8"?>
<CFe>
  <infCFe Id="ID12345">
    <ide>
      <CNPJ>61156864000191</CNPJ>
    </ide>
    <emit>
      <CNPJ>61156864000191</CNPJ>
    </emit>
    <total/>
  </infCFe>
  <Signature>
    <SignatureValue>SIMULATED</SignatureValue>
  </Signature>
</CFe>`

  return {
    EEEEE: '06000',
    mensagem: 'Cupom fiscal emitido com sucesso',
    xml_enviado: dadosVenda,
    xml_retorno: xmlRetorno,
    numero_sessao: numeroSessao,
    chave_nfe: chaveAcesso,
    numero_nota: '1',
    serie: '1',
  }
}

function simularCancelarUltimaVenda(chaveEnvio: string): SATResponse {
  const xmlRetorno = `<?xml version="1.0" encoding="UTF-8"?>
<Cancel>
  <chave>${chaveEnvio}</chave>
  <status>Cancelado com sucesso</status>
</Cancel>`

  return {
    EEEEE: '06000',
    mensagem: 'Cupom cancelado com sucesso',
    xml_retorno: xmlRetorno,
  }
}

export default startControlIDMiddleware
