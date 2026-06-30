#!/usr/bin/env bun
/**
 * Setup Interativo: Obter e Validar Código de Ativação SAT
 *
 * Uso:
 *   bun run scripts/setup-activation-code.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║          SETUP: Código de Ativação SAT Control-ID S@T-iD                  ║
╚════════════════════════════════════════════════════════════════════════════╝
`)

  console.log(`
📋 GUIA RÁPIDO:

1. Abra o Software Ativador da Control-ID
2. Conecte o S@T-iD (USB + Ethernet)
3. Clique em "Ativar Equipamento"
4. Digite um código de 8-32 caracteres
5. Confirme no SEFAZ
6. Cole o código aqui

Ou recupere usando o "Código de Emergência" na etiqueta do equipamento.
`)

  // Passo 1: Verificar se o equipamento está detectado
  console.log('\n🔍 Passo 1: Verificar Equipamento\n')

  try {
    const result = Bun.spawnSync(['lsusb'], { encoding: 'utf-8' })
    const output = result.stdout as string

    if (output.includes('Control') || output.includes('SAT') || output.includes('iD')) {
      console.log('✅ S@T-iD DETECTADO via USB!')
      console.log('   Comando: lsusb')
      console.log('   Resultado:')
      output.split('\n').forEach((line) => {
        if (line.includes('Control') || line.includes('SAT')) {
          console.log(`   ${line}`)
        }
      })
    } else {
      console.log('⚠️  S@T-iD não detectado via USB')
      console.log('   Verifique:')
      console.log('   1. Cabo USB conectado?')
      console.log('   2. S@T-iD ligado?')
      console.log('   3. Drivers instalados?')
      console.log('\n   Reconecte e tente novamente.')

      const continuar = await prompt('\nContinuar mesmo assim? (s/n): ')
      if (continuar.toLowerCase() !== 's') {
        console.log('\n❌ Setup cancelado.')
        rl.close()
        return
      }
    }
  } catch (error) {
    console.log('⚠️  Não consegui executar lsusb. Continuando...')
  }

  // Passo 2: Obter o código
  console.log('\n\n🔐 Passo 2: Código de Ativação\n')

  const codigoOpcao = await prompt('Tem o código pronto? (s = sim, n = usar código de emergência): ')

  let codigoAtivacao: string

  if (codigoOpcao.toLowerCase() === 's') {
    codigoAtivacao = await prompt('Cole o código de ativação: ')
  } else {
    codigoAtivacao = await prompt('Cole o código de EMERGÊNCIA (etiqueta traseira): ')
  }

  if (!codigoAtivacao || codigoAtivacao.length < 6) {
    console.log('❌ Código muito curto ou vazio!')
    rl.close()
    return
  }

  console.log(`\n✓ Código capturado: ${codigoAtivacao.slice(0, 3)}${'*'.repeat(Math.max(0, codigoAtivacao.length - 6))}`)

  // Passo 3: Validar formato
  console.log('\n\n📊 Passo 3: Validação\n')

  console.log(`Código digitado:`)
  console.log(`  Comprimento: ${codigoAtivacao.length} caracteres`)
  console.log(`  Contém espaços: ${codigoAtivacao.includes(' ') ? '⚠️ SIM (será removido)' : '✓ Não'}`)
  console.log(`  Contém caracteres especiais: ${/[^a-zA-Z0-9]/.test(codigoAtivacao) ? '✓ SIM' : 'Não'}`)

  // Remover espaços
  codigoAtivacao = codigoAtivacao.replace(/\s+/g, '')

  console.log(`\nApós limpeza:`)
  console.log(`  Código final: ${codigoAtivacao.slice(0, 3)}${'*'.repeat(Math.max(0, codigoAtivacao.length - 6))}`)
  console.log(`  Comprimento: ${codigoAtivacao.length} caracteres`)

  if (codigoAtivacao.length < 8 || codigoAtivacao.length > 32) {
    console.log(`\n⚠️  Código deve ter entre 8-32 caracteres!`)
    console.log(`  Seu código: ${codigoAtivacao.length} caracteres`)
    rl.close()
    return
  }

  console.log('✅ Formato válido!')

  // Passo 4: Opções de armazenamento
  console.log('\n\n💾 Passo 4: Armazenar o Código\n')

  const armazenarOpcao = await prompt('Como deseja armazenar? (1=.env.controlid, 2=apenas guardar anotado, 3=sair): ')

  if (armazenarOpcao === '1') {
    // Criar .env.controlid
    const envPath = path.join(process.cwd(), '.env.controlid')

    // Ler conteúdo atual se existir
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
      console.log(`\n⚠️  Arquivo ${envPath} já existe!`)
      const sobrescrever = await prompt('Sobrescrever? (s/n): ')
      if (sobrescrever.toLowerCase() !== 's') {
        console.log('Operação cancelada.')
        rl.close()
        return
      }
    }

    // Gerar novo .env.controlid
    const novoEnv = `# SAT Activation Code
# Gerado em: ${new Date().toISOString()}
FISCAL_SAT_ACTIVATION_CODE=${codigoAtivacao}
FISCAL_SAT_SIGNATURE_AC=SGF0b21lMzE5

# Middleware
SAT_MIDDLEWARE_PORT=9090
FISCAL_SAT_URL=http://localhost:9090

# Company (AFR Fernandes)
FISCAL_CNPJ=61156864000191
FISCAL_RAZAO=AFR FERNANDES TRANSPORTES E SERVICOS LTDA
FISCAL_UF=SP
FISCAL_MUNICIPIO=Ribeirão Preto
FISCAL_CEP=14090160
FISCAL_LOGRADOURO=Rua Funchal
FISCAL_NUMERO=500
FISCAL_BAIRRO=Vila Olimpia
FISCAL_CRT=1
FISCAL_INSCRICAO_ESTADUAL=123.456.789.012
`

    fs.writeFileSync(envPath, novoEnv, 'utf-8')

    // Proteger arquivo (chmod 600)
    fs.chmodSync(envPath, 0o600)

    console.log(`\n✅ Arquivo criado: ${envPath}`)
    console.log(`   Permissões: 600 (somente leitura para você)`)
    console.log(`   Conteúdo:`)
    novoEnv.split('\n').forEach((line) => {
      if (line.includes('ACTIVATION_CODE')) {
        console.log(`   ${line.slice(0, 25)}${'*'.repeat(Math.max(0, line.length - 32))}`)
      } else {
        console.log(`   ${line}`)
      }
    })

    // Adicionar a .gitignore
    const gitignorePath = path.join(process.cwd(), '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8')
      if (!gitignore.includes('.env.controlid')) {
        fs.appendFileSync(gitignorePath, '\n# SAT Activation Code\n.env.controlid\n')
        console.log(`\n✅ Adicionado a .gitignore`)
      }
    }

    console.log(`\n⚠️  IMPORTANTE:`)
    console.log(`   • Arquivo em .gitignore (não será commitado)`)
    console.log(`   • Protegido com chmod 600`)
    console.log(`   • Nunca share este arquivo!`)
    console.log(`   • Guardar uma cópia em cofre seguro (1Password, Bitwarden, etc)`)

  } else if (armazenarOpcao === '2') {
    console.log(`\n📝 Anote em local seguro:`)
    console.log(`\n   Código de Ativação:`)
    console.log(`   ${codigoAtivacao}`)
    console.log(`\n   Salvar em: Bitwarden, 1Password, KeePass, etc`)
  }

  // Passo 5: Teste (opcional)
  console.log('\n\n🧪 Passo 5: Testar o Código\n')

  const testar = await prompt('Deseja testar o middleware agora? (s/n): ')

  if (testar.toLowerCase() === 's') {
    console.log(`\nExecutando: SAT_MIDDLEWARE_PORT=9090 bun run controlid:middleware`)
    console.log(`Com código: ${codigoAtivacao.slice(0, 3)}${'*'.repeat(Math.max(0, codigoAtivacao.length - 6))}\n`)

    // Spawn middleware
    const env = {
      ...process.env,
      FISCAL_SAT_ACTIVATION_CODE: codigoAtivacao,
      SAT_MIDDLEWARE_PORT: '9090',
    }

    const proc = Bun.spawn(['bun', 'run', 'controlid:middleware'], {
      env,
      stdout: 'inherit',
      stderr: 'inherit',
    })

    // Aguardar inicialização
    await new Promise((r) => setTimeout(r, 2000))

    console.log(`\n✅ Middleware iniciado. Testando /health...\n`)

    try {
      const response = await fetch('http://localhost:9090/health')
      if (response.ok) {
        const data = await response.json()
        console.log('✅ SUCESSO! Middleware respondendo:')
        console.log(JSON.stringify(data, null, 2))
      }
    } catch (error) {
      console.log('⚠️  Middleware não respondeu em localhost:9090')
      console.log('   Verifique se a porta está disponível')
    }

    proc.kill()
  }

  // Resumo final
  console.log(`\n\n✅ SETUP CONCLUÍDO!\n`)
  console.log(`Próximos passos:`)
  console.log(`  1. source .env.controlid`)
  console.log(`  2. bun run controlid:middleware`)
  console.log(`  3. bun run scripts/exemplo-cupom-sat.ts`)
  console.log(`  4. Emitir seu primeiro cupom fiscal! 🎉`)

  rl.close()
}

main().catch(console.error)
