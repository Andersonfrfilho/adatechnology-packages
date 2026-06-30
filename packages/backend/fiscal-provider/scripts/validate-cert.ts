#!/usr/bin/env bun
/**
 * Script para validar o certificado A1 PFX
 *
 * Uso:
 *   FISCAL_CERT_BASE64=... FISCAL_CERT_SENHA=... bun scripts/validate-cert.ts
 */

import { loadCertificate } from '../src/sefaz/SefazXmlSigner'

const certBase64 = process.env.FISCAL_CERT_BASE64
const certSenha = process.env.FISCAL_CERT_SENHA

if (!certBase64) {
  console.error('❌ FISCAL_CERT_BASE64 não definido')
  process.exit(1)
}

if (!certSenha) {
  console.error('❌ FISCAL_CERT_SENHA não definido')
  process.exit(1)
}

try {
  console.log('🔍 Validando certificado A1...\n')

  const certData = loadCertificate(certBase64, certSenha)

  console.log('✅ Certificado carregado com sucesso!\n')
  console.log('📋 Dados do certificado:')
  console.log('───────────────────────')
  console.log(`  Tipo: e-CNPJ A1`)
  console.log(`  PEM length: ${certData.certificatePem.length} chars`)
  console.log(`  Key length: ${certData.privateKeyPem.length} chars`)
  console.log(`  Status: ✅ Válido\n`)

  console.log('🚀 Próximos passos:')
  console.log('───────────────────')
  console.log('1. NFS-e via ISS Net Online:')
  console.log('   source .env.local')
  console.log('   bun run scripts/test-fiscal.ts --nfse\n')
  console.log('2. S@T (se tiver equipamento):')
  console.log('   source .env.local')
  console.log('   bun run scripts/test-fiscal.ts --sat\n')

} catch (error) {
  console.error('❌ Erro ao carregar certificado:')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
