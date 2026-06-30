#!/usr/bin/env bun
/**
 * S@T-iD HTTP Middleware Server
 * Wrapper para libsatid.so - Control-ID
 *
 * Uso:
 *   LD_LIBRARY_PATH=/home/miyazaki/Downloads/SAT_v1.3.6/linux-x64 \
 *   FISCAL_SAT_ACTIVATION_CODE=123456 \
 *   bun run satid-middleware-server.ts
 */

import { createServer } from 'http'
import { URL } from 'url'

const PORT = parseInt(process.env.SAT_MIDDLEWARE_PORT || '8080')
const ACTIVATION_CODE = process.env.FISCAL_SAT_ACTIVATION_CODE || '123456'

// Simular resposta do SAT (por enquanto)
// Mais tarde vamos conectar a libsatid.so

interface SATResponse {
  EEEEE: string
  mensagem: string
  [key: string]: any
}

function formatErrorCode(code: number): string {
  return String(code).padStart(5, '0')
}

function getErrorMessage(code: number): string {
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
 * Simular resposta ConsultarSAT
 */
function simularConsultarSAT(): SATResponse {
  // Simulação: SAT respondeu OK
  return {
    EEEEE: '06000',
    mensagem: 'SAT respondeu OK',
    men_sefaz: 'SEFAZ respondeu',
  }
}

/**
 * Simular resposta ComunicarUnsignedSaleData
 */
function simularComunicarUnsignedSaleData(
  numeroSessao: string,
  dadosVenda: string
): SATResponse {
  // Simulação: emissão bem-sucedida
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

/**
 * Simular resposta CancelarUltimaVenda
 */
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

// ────────────────────────────────────────────────────────────────────────────

// Criar servidor HTTP
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

        // Validar código de ativação
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

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║    🚀 S@T-iD Middleware HTTP                               ║
║    Control-ID — Linux                                      ║
╚════════════════════════════════════════════════════════════╝

📍 Servidor rodando em: http://localhost:${PORT}
🔐 Código de Ativação: ${ACTIVATION_CODE}

Endpoints disponíveis:
  POST /SAT/ConsultarSAT
  POST /SAT/ComunicarUnsignedSaleData
  POST /SAT/CancelarUltimaVenda
  GET  /health

💡 Testar com:
  curl -X POST http://localhost:${PORT}/SAT/ConsultarSAT \\
    -H "Content-Type: application/x-www-form-urlencoded" \\
    -d "numeroSessao=000001&codigoDeAtivacao=${ACTIVATION_CODE}"
`)
})

server.on('error', (error) => {
  console.error('❌ Erro no servidor:', error)
  process.exit(1)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Encerrando middleware...')
  server.close()
  process.exit(0)
})
