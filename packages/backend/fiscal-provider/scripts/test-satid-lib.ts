#!/usr/bin/env bun
/**
 * Teste de carregamento da biblioteca libsatid.so
 */

import { dlopen, FFIType } from 'bun:ffi'
import * as fs from 'fs'

const LIB_PATH = '/home/miyazaki/Downloads/SAT_v1.3.6/linux-x64/libsatid.so.1.3.5'
const LIB_SYMLINK = '/home/miyazaki/Downloads/SAT_v1.3.6/linux-x64/libsatid.so'

console.log('🔍 Testando biblioteca libsatid.so...\n')

// Verificar se biblioteca existe
console.log('1️⃣ Verificando arquivo...')
if (!fs.existsSync(LIB_PATH)) {
  console.error(`❌ Biblioteca não encontrada: ${LIB_PATH}`)
  console.log('\nArquivos disponíveis:')
  const dir = '/home/miyazaki/Downloads/SAT_v1.3.6/linux-x64/'
  fs.readdirSync(dir).forEach((file) => {
    console.log(`  - ${file}`)
  })
  process.exit(1)
}
console.log(`✅ Arquivo encontrado: ${LIB_PATH}`)

// Verificar permissões
console.log('\n2️⃣ Verificando permissões...')
const stats = fs.statSync(LIB_PATH)
console.log(`  Tamanho: ${(stats.size / 1024).toFixed(2)} KB`)
console.log(`  Permissões: ${stats.mode.toString(8)}`)

// Tentar carregar biblioteca
console.log('\n3️⃣ Carregando biblioteca...')
try {
  const libsatid = dlopen(LIB_PATH, {
    // Tentar carregar função básica
    SAT_ConsultarSAT: {
      args: ['cstring'],
      returns: FFIType.int32,
    },
  })

  console.log('✅ Biblioteca carregada com sucesso!')
  console.log('\n4️⃣ Testando função SAT_ConsultarSAT...')

  try {
    const result = libsatid.symbols.SAT_ConsultarSAT('123456')
    console.log(`✅ Função retornou: ${result}`)
    console.log(`   Código de erro formatado: ${String(result).padStart(5, '0')}`)
  } catch (error) {
    console.error(`❌ Erro ao chamar função: ${error}`)
  }
} catch (error) {
  console.error(`❌ Erro ao carregar biblioteca: ${error}`)
  console.log('\n💡 Soluções possíveis:')
  console.log('   1. Instalar dependências: sudo apt-get install libssl-dev')
  console.log('   2. Ajustar LD_LIBRARY_PATH: export LD_LIBRARY_PATH=/home/miyazaki/Downloads/SAT_v1.3.6/linux-x64:$LD_LIBRARY_PATH')
  console.log('   3. Criar symlink: ln -s libsatid.so.1.3.5 libsatid.so')
  process.exit(1)
}

console.log('\n✅ Teste concluído com sucesso!')
