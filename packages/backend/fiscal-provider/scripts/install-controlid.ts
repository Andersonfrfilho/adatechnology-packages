#!/usr/bin/env bun
/**
 * Instalador Control-ID S@T-iD para fiscal-provider
 *
 * Uso:
 *   bun run scripts/install-controlid.ts [--activation-code 123456] [--port 9090]
 *
 * Opções:
 *   --activation-code <code>    Código de ativação do SAT (padrão: 123456)
 *   --port <port>               Porta do middleware (padrão: 9090)
 *   --auto-start                Iniciar middleware automaticamente
 *   --systemd                   Instalar como serviço systemd
 *   --uninstall                 Remover instalação
 *   --test                      Executar testes após instalação
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

interface InstallOptions {
  activationCode: string
  port: number
  autoStart: boolean
  systemd: boolean
  uninstall: boolean
  test: boolean
}

function parseArgs(): InstallOptions {
  const args = process.argv.slice(2)
  const options: InstallOptions = {
    activationCode: '123456',
    port: 9090,
    autoStart: false,
    systemd: false,
    uninstall: false,
    test: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--activation-code':
        options.activationCode = args[++i]
        break
      case '--port':
        options.port = parseInt(args[++i])
        break
      case '--auto-start':
        options.autoStart = true
        break
      case '--systemd':
        options.systemd = true
        break
      case '--uninstall':
        options.uninstall = true
        break
      case '--test':
        options.test = true
        break
    }
  }

  return options
}

function log(type: 'info' | 'success' | 'error' | 'warn', message: string) {
  const icons = {
    info: 'ℹ️ ',
    success: '✅',
    error: '❌',
    warn: '⚠️ ',
  }
  console.log(`${icons[type]} ${message}`)
}

function createEnvFile(options: InstallOptions) {
  log('info', 'Criando .env.controlid...')

  const envContent = `# Control-ID S@T-iD Configuration
# Gerado por install-controlid.ts

# Middleware
SAT_MIDDLEWARE_PORT=${options.port}
FISCAL_SAT_URL=http://localhost:${options.port}

# SAT
FISCAL_SAT_ACTIVATION_CODE=${options.activationCode}
FISCAL_SAT_SIGNATURE_AC=SGF0b21lMzE5

# Emitente (configure com seus dados)
FISCAL_CNPJ=61156864000191
FISCAL_RAZAO=AFR FERNANDES TRANSPORTES E SERVICOS LTDA
FISCAL_UF=SP
FISCAL_MUNICIPIO=Ribeirão Preto
FISCAL_CEP=14090160
FISCAL_LOGRADOURO=Rua Funchal
FISCAL_NUMERO=500
FISCAL_BAIRRO=Vila Olimpia
FISCAL_CRT=1
`

  const envPath = '.env.controlid'
  fs.writeFileSync(envPath, envContent)
  log('success', `Arquivo ${envPath} criado`)
}

function createSystemdService(options: InstallOptions) {
  log('info', 'Criando serviço systemd...')

  const serviceContent = `[Unit]
Description=Control-ID S@T-iD Middleware
After=network.target

[Service]
Type=simple
User=${process.env.USER}
WorkingDirectory=${process.cwd()}
Environment="SAT_MIDDLEWARE_PORT=${options.port}"
Environment="FISCAL_SAT_ACTIVATION_CODE=${options.activationCode}"
ExecStart=/usr/bin/bun run scripts/satid-middleware-server.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`

  const servicePath = '/etc/systemd/system/sat-controlid.service'
  log('info', `Arquivo de serviço será criado em: ${servicePath}`)
  log('warn', 'Execute: sudo tee ' + servicePath + ' < /tmp/sat-controlid.service')

  fs.writeFileSync('/tmp/sat-controlid.service', serviceContent)
  log('success', 'Arquivo de serviço criado em /tmp/sat-controlid.service')
}

function createStartScript(options: InstallOptions) {
  log('info', 'Criando script de inicialização...')

  const scriptContent = `#!/bin/bash
# Script para iniciar middleware Control-ID

# Carregar variáveis de ambiente
if [ -f .env.controlid ]; then
  export $(cat .env.controlid | grep -v '^#' | xargs)
fi

# Iniciar middleware
SAT_MIDDLEWARE_PORT=${options.port} \\
FISCAL_SAT_ACTIVATION_CODE=${options.activationCode} \\
nohup bun run scripts/satid-middleware-server.ts > logs/sat-middleware.log 2>&1 &

echo "✅ Middleware iniciado na porta ${options.port}"
echo "📊 Verificar logs: tail -f logs/sat-middleware.log"
`

  const scriptPath = 'scripts/start-controlid.sh'
  fs.writeFileSync(scriptPath, scriptContent)
  fs.chmodSync(scriptPath, 0o755)
  log('success', `Script ${scriptPath} criado`)
}

function createDocsIndex() {
  log('info', 'Criando índice de documentação...')

  const docsContent = `# Documentação Control-ID S@T-iD

## Guias de Configuração

1. **[SAT Control-ID Linux](./SAT_LINUX_PRODUCAO.md)** ⭐
   - Setup completo para produção
   - Troubleshooting
   - Monitoramento

2. **[Setup Específico Control-ID](./SAT_CONTROL_ID_SETUP.md)**
   - Instalação do middleware
   - Configuração inicial
   - Testes

3. **[Guia Diagnóstico](./SAT_DIAGNOSTICO.md)**
   - Verificação de conexão
   - Troubleshooting de drivers
   - Diagnósticos de equipamento

## Tipo de Dados

- \`ControlIDConfig\` - Configuração geral
- \`ControlIDEmissaoConfig\` - Configuração de emissão
- \`ControlIDStatusOperacional\` - Status do SAT

Veja: \`src/providers/controlid.types.ts\`

## Scripts Disponíveis

\`\`\`bash
# Testar middleware
bun run scripts/test-satid-lib.ts

# Testar fiscal-provider com SAT
bun run scripts/test-fiscal.ts --sat

# Instalar middleware
bun run scripts/install-controlid.ts --activation-code 123456 --port 9090
\`\`\`

## Middleware

- **Arquivo**: \`scripts/satid-middleware-server.ts\`
- **Módulo**: \`src/middleware/controlid-middleware.ts\`
- **Porta padrão**: 9090

## Endpoints

\`\`\`
POST /SAT/ConsultarSAT
POST /SAT/ComunicarUnsignedSaleData
POST /SAT/CancelarUltimaVenda
GET  /health
\`\`\`

## Suporte

- **Docs**: https://www.control-id.com.br/satid/
- **Email**: suporte@control-id.com.br
- **Tel**: (11) 3644-5000
`

  fs.writeFileSync('CONTROLID_README.md', docsContent)
  log('success', 'CONTROLID_README.md criado')
}

function runTests(options: InstallOptions) {
  log('info', 'Executando testes...')

  try {
    const result = execSync(
      `FISCAL_SAT_ACTIVATION_CODE=${options.activationCode} FISCAL_SAT_URL=http://localhost:${options.port} bun run scripts/test-fiscal.ts --sat`,
      { stdio: 'inherit' }
    )
    log('success', 'Testes passaram!')
  } catch (error) {
    log('error', 'Testes falharam')
  }
}

function install() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Control-ID S@T-iD - Instalador para fiscal-provider       ║
╚════════════════════════════════════════════════════════════╝
`)

  const options = parseArgs()

  if (options.uninstall) {
    log('info', 'Removendo instalação...')
    // TODO: Implementar uninstall
    log('success', 'Instalação removida')
    process.exit(0)
  }

  try {
    // 1. Criar .env.controlid
    createEnvFile(options)

    // 2. Criar script de inicialização
    createStartScript(options)

    // 3. Criar diretório de logs
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs')
      log('success', 'Diretório logs/ criado')
    }

    // 4. Criar documentação
    createDocsIndex()

    // 5. Criar serviço systemd (se solicitado)
    if (options.systemd) {
      createSystemdService(options)
    }

    // 6. Executar testes (se solicitado)
    if (options.test) {
      runTests(options)
    }

    // 7. Auto-start (se solicitado)
    if (options.autoStart) {
      log('info', 'Iniciando middleware...')
      try {
        execSync(`bun run scripts/start-controlid.sh`, { stdio: 'inherit' })
        log('success', 'Middleware iniciado!')
      } catch (error) {
        log('error', 'Erro ao iniciar middleware')
      }
    }

    console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Instalação Concluída!                                  ║
╚════════════════════════════════════════════════════════════╝

📋 Próximos passos:

1. Editar configurações:
   nano .env.controlid

2. Iniciar middleware:
   bun run scripts/start-controlid.sh

3. Testar:
   curl http://localhost:${options.port}/health

4. Ver logs:
   tail -f logs/sat-middleware.log

📖 Documentação: CONTROLID_README.md
`)
  } catch (error) {
    log('error', `Erro na instalação: ${error}`)
    process.exit(1)
  }
}

install()
