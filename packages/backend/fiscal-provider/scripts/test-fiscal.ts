/**
 * Script de testes integrados do fiscal-provider.
 *
 * Modos:
 *   bun run scripts/test-fiscal.ts        → testes locais (sem rede)
 *   bun run scripts/test-fiscal.ts --sat      → + SAT real (precisa env vars)
 *   bun run scripts/test-fiscal.ts --nfce     → + NFC-e SEFAZ homologação
 *   bun run scripts/test-fiscal.ts --nfe      → + NF-e SEFAZ homologação
 *   bun run scripts/test-fiscal.ts --nfse     → + NFS-e ABRASF homologação
 *   bun run scripts/test-fiscal.ts --nfse-sub → + NFS-e substituição
 *   bun run scripts/test-fiscal.ts --notarp   → + NFS-e NotaRP REST
 *   bun run scripts/test-fiscal.ts --all      → todos os testes
 *
 * Variáveis de ambiente (prefixo FISCAL_):
 *
 *   Emitente (padrão: empresa fictícia de teste):
 *     FISCAL_CNPJ, FISCAL_IE, FISCAL_RAZAO, FISCAL_UF, FISCAL_MUNICIPIO
 *     FISCAL_CEP, FISCAL_LOGRADOURO, FISCAL_NUMERO, FISCAL_BAIRRO
 *
 *   Certificado A1 (NFC-e e NFS-e):
 *     FISCAL_CERT_BASE64   → base64 -i certificado.pfx
 *     FISCAL_CERT_SENHA
 *
 *   NFC-e direta SEFAZ:
 *     FISCAL_SERIE, FISCAL_NUMERO_NF, FISCAL_CODIGO_MUNICIPIO
 *     FISCAL_CSC_ID (ex: '000002'), FISCAL_CSC_TOKEN
 *
 *   SAT:
 *     FISCAL_SAT_URL, FISCAL_SAT_ACTIVATION_CODE, FISCAL_SAT_SIGNATURE_AC
 *
 *   NF-e direta SEFAZ:
 *     FISCAL_CERT_BASE64, FISCAL_CERT_SENHA
 *     FISCAL_SERIE, FISCAL_NUMERO_NF, FISCAL_CODIGO_MUNICIPIO
 *     FISCAL_NFE_DEST_CNPJ      → CNPJ do destinatário
 *     FISCAL_NFE_DEST_NOME      → razão social do destinatário
 *     FISCAL_NFE_DEST_CEP, FISCAL_NFE_DEST_LOGRADOURO, FISCAL_NFE_DEST_NUMERO
 *     FISCAL_NFE_DEST_BAIRRO, FISCAL_NFE_DEST_MUNICIPIO, FISCAL_NFE_DEST_UF
 *     FISCAL_NFE_DEST_COD_MUN   → código IBGE do município do destinatário
 *
 *   NFS-e direta ABRASF:
 *     FISCAL_NFSE_URL           → URL do webservice do município
 *     FISCAL_INSCRICAO_MUNICIPAL
 *     FISCAL_CODIGO_MUNICIPIO
 *     FISCAL_CODIGO_SERVICO     (ex: '17.01')
 *     FISCAL_ALIQUOTA_ISS       (ex: '5.00')
 *
 *   NFS-e substituição (--nfse-sub):
 *     mesmas de --nfse
 *     FISCAL_NFSE_NUMERO_ORIGINAL → número da NFS-e a ser substituída
 */

import {
  createFiscalProvider,
  type NfceConfig,
  type NfeConfig,
  type NfeData,
  type SatConfig,
  type NfseConfig,
  type NotaRpConfig,
  type CteConfig,
  type CteData,
  type EmitFiscalParams,
  type FiscalResult,
} from '../src/index'
import { buildChaveAcesso } from '../src/sefaz/SefazChave'
import { buildQrCodeUrl } from '../src/sefaz/SefazQrCode'
import { buildDanfce } from '../src/danfce/DanfceBuilder'
import { buildNfeXml } from '../src/sefaz/NfeXmlBuilder'
import { buildCteXml } from '../src/sefaz/CteXmlBuilder'
import { signCteXml, loadCertificate } from '../src/sefaz/SefazXmlSigner'

const args = process.argv.slice(2)
const runAll = args.includes('--all')
const runSat = runAll || args.includes('--sat')
const runNfce = runAll || args.includes('--nfce')
const runNfe = runAll || args.includes('--nfe')
const runNfse = runAll || args.includes('--nfse')
const runNfseSub = runAll || args.includes('--nfse-sub')
const runNotaRp = runAll || args.includes('--notarp')
const runCte = runAll || args.includes('--cte')

let passed = 0
let failed = 0
let skipped = 0

function ok(label: string, result: boolean, detail?: string): void {
  if (result) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function skip(label: string, reason: string): void {
  console.log(`  ○ ${label} (pulado: ${reason})`)
  skipped++
}

function section(title: string): void {
  console.log(`\n── ${title} ──`)
}

function env(key: string): string | undefined {
  return process.env[key]
}

function requireEnv(...keys: string[]): boolean {
  const missing = keys.filter((k) => !env(k))
  if (missing.length > 0) {
    console.log(`  ○ variáveis ausentes: ${missing.join(', ')}`)
    skipped += keys.length
    return false
  }
  return true
}

function buildBaseEmitente() {
  return {
    environment: 'homologacao' as const,
    cnpj: env('FISCAL_CNPJ') ?? '11222333000181',
    inscricaoEstadual: env('FISCAL_IE') ?? '111111111111',
    razaoSocial: env('FISCAL_RAZAO') ?? 'EMPRESA DE TESTE LTDA',
    uf: env('FISCAL_UF') ?? 'SP',
    municipio: env('FISCAL_MUNICIPIO') ?? 'Sao Paulo',
    cep: env('FISCAL_CEP') ?? '01310100',
    logradouro: env('FISCAL_LOGRADOURO') ?? 'Avenida Paulista',
    numero: env('FISCAL_NUMERO') ?? '1000',
    bairro: env('FISCAL_BAIRRO') ?? 'Bela Vista',
    crt: '1' as const,
  }
}

function buildBaseEmitParams(config: EmitFiscalParams['config']): EmitFiscalParams {
  return {
    referenceId: `TEST-${Date.now()}`,
    config,
    totalAmount: 10.0,
    discountAmount: 0,
    customerCpf: '00000000000',
    items: [
      {
        codigo: '001',
        descricao: 'Produto de Teste',
        ncm: '21069090',
        cfop: '5102',
        cst: '400',
        unidade: 'UN',
        quantidade: 1,
        valorUnitario: 10.0,
        valorTotal: 10.0,
      },
    ],
    payments: [{ method: 'pix', amount: 10.0 }],
  }
}

// ─── 1. Testes locais (sem rede) ──────────────────────────────────────────────

section('Chave de acesso NFC-e + NF-e (local)')

try {
  const chaveNfce = buildChaveAcesso({
    uf: 'SP',
    dataEmissao: new Date('2025-01-01'),
    cnpj: '11222333000181',
    serie: '001',
    numeroNf: 1,
  })
  const chaveNfe = buildChaveAcesso({
    uf: 'SP',
    dataEmissao: new Date('2025-01-01'),
    cnpj: '11222333000181',
    serie: '001',
    numeroNf: 1,
    mod: '55',
  })
  const url = buildQrCodeUrl({
    chave: chaveNfce,
    cscId: '000002',
    cscToken: 'c24abf22-eedc-4e76-b06c-F9c1ff6e2c29',
    uf: 'SP',
    environment: 'homologacao',
    tpAmb: '2',
  })
  ok(
    'NFC-e: chave 44 dígitos com mod=65',
    chaveNfce.chave.length === 44 && chaveNfce.chave.includes('65'),
    chaveNfce.chave.slice(0, 10) + '…',
  )
  ok(
    'NF-e:  chave 44 dígitos com mod=55',
    chaveNfe.chave.length === 44 && chaveNfe.chave.includes('55'),
    chaveNfe.chave.slice(0, 10) + '…',
  )
  ok('buildQrCodeUrl retorna URL com parâmetros', url.includes('?p='), url.slice(0, 80))
} catch (error) {
  ok('buildChaveAcesso / buildQrCodeUrl', false, String(error))
}

section('DANFCE builder (local)')

try {
  const nfceConfig: NfceConfig = {
    model: 'nfce',
    environment: 'homologacao',
    cnpj: '11222333000181',
    inscricaoEstadual: '111111111111',
    razaoSocial: 'EMPRESA DE TESTE LTDA',
    uf: 'SP',
    municipio: 'Sao Paulo',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64: '',
    certificadoSenha: '',
    serie: '001',
    numeroNf: 1,
    codigoMunicipio: '3550308',
    cscId: '000002',
    cscToken: 'c24abf22-eedc-4e76-b06c-F9c1ff6e2c29',
  }
  const emitParams = buildBaseEmitParams(nfceConfig)
  const fakeResult: FiscalResult = {
    success: true,
    chaveAcesso: '35250611222333000181650010000000011000000014',
    protocolo: '135000000000001',
    numeroDocumento: 1,
    rawResponse: null,
  }
  const danfce = buildDanfce({
    emitParams,
    config: nfceConfig,
    result: fakeResult,
    qrCodeUrl: 'https://qr.exemplo.com/consulta',
    urlConsulta: 'https://consulta.exemplo.com',
    dataEmissao: new Date(),
  })
  ok('buildDanfce contém razão social', danfce.text.includes('EMPRESA DE TESTE'))
  ok('buildDanfce inclui QR code URL', danfce.qrCodeUrl.length > 0)
} catch (error) {
  ok('buildDanfce', false, String(error))
}

section('NF-e XML builder (local)')

try {
  const nfeConfigLocal: NfeConfig = {
    model: 'nfe',
    environment: 'homologacao',
    cnpj: '11222333000181',
    inscricaoEstadual: '111111111111',
    razaoSocial: 'EMPRESA EMISSORA TESTE LTDA',
    uf: 'SP',
    municipio: 'Sao Paulo',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64: '',
    certificadoSenha: '',
    serie: '001',
    numeroNf: 1,
    codigoMunicipio: '3550308',
  }

  const chaveNfe = buildChaveAcesso({
    uf: 'SP',
    dataEmissao: new Date('2025-01-01'),
    cnpj: '11222333000181',
    serie: '001',
    numeroNf: 1,
    mod: '55',
  })

  const nfeDataLocal: NfeData = {
    destinatario: {
      cnpj: '33683111000107',
      xNome: 'EMPRESA DESTINATARIA TESTE SA',
      codigoMunicipio: '3550308',
      cep: '04534011',
      logradouro: 'Rua Funchal',
      numero: '500',
      bairro: 'Vila Olimpia',
      municipio: 'Sao Paulo',
      uf: 'SP',
      indicadorIe: '9',
    },
    naturezaOperacao: 'Venda de mercadoria',
    finalidade: '1',
  }

  const nfeXml = buildNfeXml({
    params: buildBaseEmitParams(nfeConfigLocal),
    config: nfeConfigLocal,
    nfeData: nfeDataLocal,
    chave: chaveNfe,
    dataEmissao: new Date('2025-01-01T10:00:00'),
  })

  ok('buildNfeXml sem erro', true)
  ok('mod=55 presente no XML', nfeXml.includes('<mod>55</mod>'), 'mod tag')
  ok('tpImp=1 (DANFE A4) no XML', nfeXml.includes('<tpImp>1</tpImp>'), 'tpImp tag')
  ok('bloco <dest> presente com CNPJ', nfeXml.includes('<dest>') && nfeXml.includes('33683111000107'), 'dest block')
  ok('bloco <emit> presente', nfeXml.includes('<emit>'), 'emit block')
  ok('bloco <transp> presente', nfeXml.includes('<transp>'), 'transp block')
  ok('sem <infNFeSupl> (sem QR code)', !nfeXml.includes('infNFeSupl'), 'no qr code tag')
  ok('Id começa com NFe', chaveNfe.id.startsWith('NFe'), chaveNfe.id.slice(0, 10))
} catch (error) {
  ok('buildNfeXml', false, String(error))
}

section('Carregamento de certificado A1 (local)')

const certBase64 = env('FISCAL_CERT_BASE64')
const certSenha = env('FISCAL_CERT_SENHA')

if (certBase64 && certSenha) {
  try {
    const { loadCertificate } = await import('../src/sefaz/SefazXmlSigner')
    const certData = loadCertificate(certBase64, certSenha)
    ok('parse do PFX sem erro', true)
    ok('certificatePem começa com -----BEGIN', certData.certificatePem.startsWith('-----BEGIN'))
    ok('privateKeyPem começa com -----BEGIN', certData.privateKeyPem.startsWith('-----BEGIN'))
  } catch (error) {
    ok('loadCertificate', false, String(error))
  }
} else {
  skip('parse PFX', 'defina FISCAL_CERT_BASE64 e FISCAL_CERT_SENHA')
  skip('certificatePem válido', 'cert ausente')
  skip('privateKeyPem válido', 'cert ausente')
}

// ─── 2. SAT ───────────────────────────────────────────────────────────────────

section('SAT (equipamento real)')

if (!runSat) {
  skip('testConnection SAT', 'use --sat para executar')
  skip('emissão SAT', 'use --sat para executar')
} else if (!requireEnv('FISCAL_SAT_URL', 'FISCAL_SAT_ACTIVATION_CODE', 'FISCAL_SAT_SIGNATURE_AC')) {
  // ausentes já logados
} else {
  const satConfig: SatConfig = {
    ...buildBaseEmitente(),
    model: 'sat',
    satUrl: env('FISCAL_SAT_URL')!,
    activationCode: env('FISCAL_SAT_ACTIVATION_CODE')!,
    signatureAC: env('FISCAL_SAT_SIGNATURE_AC')!,
  }
  const provider = createFiscalProvider(satConfig)

  const conn = await provider.testConnection({ config: satConfig })
  ok('testConnection SAT', conn.ok, conn.message)

  if (conn.ok) {
    const result = await provider.emit(buildBaseEmitParams(satConfig))
    ok('emissão SAT', result.success, result.errorMessage)
    if (result.success) console.log(`    chaveAcesso: ${result.chaveAcesso}`)
  }
}

// ─── 3. NFC-e direta SEFAZ ───────────────────────────────────────────────────

section('NFC-e direta SEFAZ')

if (!runNfce) {
  skip('testConnection NFC-e', 'use --nfce para executar')
  skip('emissão NFC-e', 'use --nfce para executar')
} else if (!requireEnv('FISCAL_CERT_BASE64', 'FISCAL_CERT_SENHA', 'FISCAL_CSC_TOKEN', 'FISCAL_CODIGO_MUNICIPIO')) {
  // ausentes já logados
} else {
  const nfceConfig: NfceConfig = {
    ...buildBaseEmitente(),
    model: 'nfce',
    certificadoBase64: env('FISCAL_CERT_BASE64')!,
    certificadoSenha: env('FISCAL_CERT_SENHA')!,
    serie: env('FISCAL_SERIE') ?? '001',
    numeroNf: parseInt(env('FISCAL_NUMERO_NF') ?? '1', 10),
    codigoMunicipio: env('FISCAL_CODIGO_MUNICIPIO')!,
    cscId: env('FISCAL_CSC_ID') ?? '000002',
    cscToken: env('FISCAL_CSC_TOKEN')!,
  }
  const provider = createFiscalProvider(nfceConfig)

  const conn = await provider.testConnection({ config: nfceConfig })
  ok('testConnection NFC-e SEFAZ', conn.ok, conn.message)

  if (conn.ok) {
    const result: FiscalResult = await provider.emit(buildBaseEmitParams(nfceConfig))
    ok('emissão NFC-e', result.success, result.errorMessage)
    if (result.success) {
      console.log(`    chaveAcesso: ${result.chaveAcesso}`)
      console.log(`    protocolo:   ${result.protocolo}`)
      const cancelResult = await provider.cancel({
        chaveAcesso: result.chaveAcesso!,
        protocolo: result.protocolo!,
        justificativa: 'Teste automatizado — cancelamento imediato após emissão',
        config: nfceConfig,
      })
      ok('cancelamento NFC-e', cancelResult.success, cancelResult.errorMessage)
    } else {
      console.log(`    rawResponse: ${JSON.stringify(result.rawResponse).slice(0, 300)}`)
    }
  }
}

// ─── 4. NF-e direta SEFAZ ────────────────────────────────────────────────────

section('NF-e direta SEFAZ (modelo 55)')

if (!runNfe) {
  skip('testConnection NF-e', 'use --nfe para executar')
  skip('emissão NF-e', 'use --nfe para executar')
} else if (
  !requireEnv(
    'FISCAL_CERT_BASE64',
    'FISCAL_CERT_SENHA',
    'FISCAL_CODIGO_MUNICIPIO',
    'FISCAL_NFE_DEST_CNPJ',
    'FISCAL_NFE_DEST_NOME',
    'FISCAL_NFE_DEST_CEP',
    'FISCAL_NFE_DEST_LOGRADOURO',
    'FISCAL_NFE_DEST_NUMERO',
    'FISCAL_NFE_DEST_BAIRRO',
    'FISCAL_NFE_DEST_MUNICIPIO',
    'FISCAL_NFE_DEST_UF',
    'FISCAL_NFE_DEST_COD_MUN',
  )
) {
  // ausentes já logados
} else {
  const nfeConfig: NfeConfig = {
    ...buildBaseEmitente(),
    model: 'nfe',
    certificadoBase64: env('FISCAL_CERT_BASE64')!,
    certificadoSenha: env('FISCAL_CERT_SENHA')!,
    serie: env('FISCAL_SERIE') ?? '001',
    numeroNf: parseInt(env('FISCAL_NUMERO_NF') ?? '1', 10),
    codigoMunicipio: env('FISCAL_CODIGO_MUNICIPIO')!,
  }

  const nfeData: NfeData = {
    destinatario: {
      cnpj: env('FISCAL_NFE_DEST_CNPJ')!,
      xNome: env('FISCAL_NFE_DEST_NOME')!,
      codigoMunicipio: env('FISCAL_NFE_DEST_COD_MUN')!,
      cep: env('FISCAL_NFE_DEST_CEP')!,
      logradouro: env('FISCAL_NFE_DEST_LOGRADOURO')!,
      numero: env('FISCAL_NFE_DEST_NUMERO')!,
      bairro: env('FISCAL_NFE_DEST_BAIRRO')!,
      municipio: env('FISCAL_NFE_DEST_MUNICIPIO')!,
      uf: env('FISCAL_NFE_DEST_UF')!,
      indicadorIe: '9',
    },
    naturezaOperacao: 'Venda de mercadoria — homologação',
  }

  const provider = createFiscalProvider(nfeConfig)

  const conn = await provider.testConnection({ config: nfeConfig })
  ok('testConnection NF-e SEFAZ', conn.ok, conn.message)

  if (conn.ok) {
    const result: FiscalResult = await provider.emit({
      ...buildBaseEmitParams(nfeConfig),
      nfeData,
    })
    ok('emissão NF-e', result.success, result.errorMessage)
    if (result.success) {
      console.log(`    chaveAcesso: ${result.chaveAcesso}`)
      console.log(`    protocolo:   ${result.protocolo}`)
      const cancelResult = await provider.cancel({
        chaveAcesso: result.chaveAcesso!,
        protocolo: result.protocolo!,
        justificativa: 'Teste automatizado — cancelamento imediato após emissão NF-e',
        config: nfeConfig,
      })
      ok('cancelamento NF-e', cancelResult.success, cancelResult.errorMessage)
    } else {
      console.log(`    rawResponse: ${JSON.stringify(result.rawResponse).slice(0, 300)}`)
    }
  }
}

// ─── 5. NFS-e direta ABRASF ──────────────────────────────────────────────────

section('NFS-e direta ABRASF')

if (!runNfse) {
  skip('testConnection NFS-e', 'use --nfse para executar')
  skip('emissão NFS-e', 'use --nfse para executar')
  skip('cancelamento NFS-e', 'use --nfse para executar')
} else if (
  !requireEnv(
    'FISCAL_CERT_BASE64',
    'FISCAL_CERT_SENHA',
    'FISCAL_NFSE_URL',
    'FISCAL_INSCRICAO_MUNICIPAL',
    'FISCAL_CODIGO_MUNICIPIO',
    'FISCAL_CODIGO_SERVICO',
  )
) {
  // ausentes já logados
} else {
  const nfseConfig: NfseConfig = {
    ...buildBaseEmitente(),
    model: 'nfse',
    certificadoBase64: env('FISCAL_CERT_BASE64')!,
    certificadoSenha: env('FISCAL_CERT_SENHA')!,
    webserviceUrl: env('FISCAL_NFSE_URL')!,
    inscricaoMunicipal: env('FISCAL_INSCRICAO_MUNICIPAL')!,
    codigoMunicipio: env('FISCAL_CODIGO_MUNICIPIO')!,
    codigoServico: env('FISCAL_CODIGO_SERVICO')!,
    aliquotaIss: parseFloat(env('FISCAL_ALIQUOTA_ISS') ?? '5.00'),
    issRetido: false,
  }
  const provider = createFiscalProvider(nfseConfig)

  const conn = await provider.testConnection({ config: nfseConfig })
  ok('webservice municipal acessível', conn.ok, conn.message)

  if (conn.ok) {
    const emitParams: EmitFiscalParams = {
      ...buildBaseEmitParams(nfseConfig),
      totalAmount: 500.0,
      payments: [{ method: 'pix', amount: 500.0 }],
      nfseData: {
        discriminacao: 'Serviços de tecnologia da informação — teste automatizado',
        competencia: new Date().toISOString().slice(0, 7),
      },
    }
    const result = await provider.emit(emitParams)
    ok('emissão NFS-e', result.success, result.errorMessage)

    if (result.success) {
      const numeroNfse = String(result.numeroDocumento ?? '')
      console.log(`    número NFS-e: ${numeroNfse}`)
      const cancelResult = await provider.cancel({
        chaveAcesso: numeroNfse,
        justificativa: 'Teste automatizado — cancelamento imediato após emissão',
        codigoCancelamento: '1',
        config: nfseConfig,
      })
      ok('cancelamento NFS-e', cancelResult.success, cancelResult.errorMessage)
    } else {
      console.log(`    rawResponse: ${JSON.stringify(result.rawResponse).slice(0, 300)}`)
    }
  }
}

// ─── 6. NFS-e substituição (SubstituirNfse ABRASF) ───────────────────────────

section('NFS-e substituição (SubstituirNfse)')

if (!runNfseSub) {
  skip('emissão NFS-e substituta', 'use --nfse-sub para executar')
} else if (
  !requireEnv(
    'FISCAL_CERT_BASE64',
    'FISCAL_CERT_SENHA',
    'FISCAL_NFSE_URL',
    'FISCAL_INSCRICAO_MUNICIPAL',
    'FISCAL_CODIGO_MUNICIPIO',
    'FISCAL_CODIGO_SERVICO',
    'FISCAL_NFSE_NUMERO_ORIGINAL',
  )
) {
  // ausentes já logados
} else {
  const nfseSubConfig: NfseConfig = {
    ...buildBaseEmitente(),
    model: 'nfse',
    certificadoBase64: env('FISCAL_CERT_BASE64')!,
    certificadoSenha: env('FISCAL_CERT_SENHA')!,
    webserviceUrl: env('FISCAL_NFSE_URL')!,
    inscricaoMunicipal: env('FISCAL_INSCRICAO_MUNICIPAL')!,
    codigoMunicipio: env('FISCAL_CODIGO_MUNICIPIO')!,
    codigoServico: env('FISCAL_CODIGO_SERVICO')!,
    aliquotaIss: parseFloat(env('FISCAL_ALIQUOTA_ISS') ?? '5.00'),
    issRetido: false,
  }

  const provider = createFiscalProvider(nfseSubConfig)

  const subEmitParams: EmitFiscalParams = {
    ...buildBaseEmitParams(nfseSubConfig),
    totalAmount: 600.0,
    payments: [{ method: 'pix', amount: 600.0 }],
    nfseData: {
      discriminacao: 'Substituição de NFS-e — teste automatizado SubstituirNfse',
      competencia: new Date().toISOString().slice(0, 7),
      nfseSubstituida: env('FISCAL_NFSE_NUMERO_ORIGINAL')!,
    },
  }

  const result = await provider.emit(subEmitParams)
  ok('SubstituirNfse emitida', result.success, result.errorMessage)
  if (result.success) {
    console.log(`    nova NFS-e:   ${result.numeroDocumento}`)
    console.log(`    substituída:  ${env('FISCAL_NFSE_NUMERO_ORIGINAL')}`)
  } else {
    console.log(`    rawResponse: ${JSON.stringify(result.rawResponse).slice(0, 300)}`)
  }
}

// ─── 7. NotaRP NFS-e ─────────────────────────────────────────────────────────
//
// Variáveis:
//   NOTARP_API_TOKEN           token gerado em notarp.com.br/configuracoes/api
//   NOTARP_CNPJ                CNPJ do prestador (só dígitos ou formatado)
//   NOTARP_INSCRICAO_MUNICIPAL inscrição municipal do prestador
//   NOTARP_COD_TRIBUTACAO_NAC  código de tributação nacional (ex: '0105')
//   NOTARP_COD_TRIBUTACAO_MUN  código de tributação municipal (ex: '010501')
//   NOTARP_COD_NBS             código NBS (ex: '1.0501')
//   NOTARP_MUNICIPIO_IBGE      código IBGE 7 dígitos (ex: '3543402' para RP)
//   NOTARP_ALIQUOTA_ISS        alíquota ISS em % (ex: '2.00')
//   NOTARP_BASE_URL            opcional — omitir usa v3; setar para v2 se RP
//
// ATENÇÃO: v3 NÃO suporta Ribeirão Preto ainda — use NOTARP_BASE_URL apontando
// para a v2 enquanto o suporte a RP não for publicado pela Nota Control.

section('NotaRP NFS-e')

if (!runNotaRp) {
  skip('testConnection NotaRP', 'use --notarp para executar')
  skip('emissão NFS-e NotaRP', 'use --notarp para executar')
  skip('cancelamento NFS-e NotaRP', 'use --notarp para executar')
} else if (
  !requireEnv(
    'NOTARP_API_TOKEN',
    'NOTARP_CNPJ',
    'NOTARP_INSCRICAO_MUNICIPAL',
    'NOTARP_COD_TRIBUTACAO_NAC',
    'NOTARP_COD_TRIBUTACAO_MUN',
    'NOTARP_COD_NBS',
    'NOTARP_MUNICIPIO_IBGE',
    'NOTARP_ALIQUOTA_ISS',
  )
) {
  // ausentes já logados
} else {
  const notarpConfig: NotaRpConfig = {
    model: 'nfse-notarp',
    environment: 'homologacao',
    cnpj: env('NOTARP_CNPJ')!,
    razaoSocial: env('FISCAL_RAZAO') ?? 'EMPRESA DE TESTE LTDA',
    inscricaoMunicipal: env('NOTARP_INSCRICAO_MUNICIPAL')!,
    apiToken: env('NOTARP_API_TOKEN')!,
    baseUrl: env('NOTARP_BASE_URL'),
  }

  const notarpProvider = createFiscalProvider(notarpConfig)

  // testConnection
  const connResult = await notarpProvider.testConnection({ config: notarpConfig })
  ok('testConnection NotaRP', connResult.ok, connResult.message)

  if (connResult.ok) {
    const today = new Date()
    const dataCompetencia = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

    const emitParams: EmitFiscalParams = {
      referenceId: `notarp-teste-${Date.now()}`,
      items: [],
      payments: [{ method: 'pix', amount: 100.0 }],
      totalAmount: 100.0,
      discountAmount: 0,
      config: notarpConfig,
      notaRpNfseData: {
        descricao: 'Serviço de teste automatizado — NotaRpNfseProvider',
        valorTotal: 100.0,
        codigoTributacaoNacional: env('NOTARP_COD_TRIBUTACAO_NAC')!,
        codigoTributacaoMunicipal: env('NOTARP_COD_TRIBUTACAO_MUN')!,
        codigoNbs: env('NOTARP_COD_NBS')!,
        dataCompetencia,
        municipio: env('NOTARP_MUNICIPIO_IBGE')!,
        aliquotaIssqn: Number(env('NOTARP_ALIQUOTA_ISS')!),
        issqnRetido: false,
        hashPedido: `fiscal-provider-test-${Date.now()}`,
        enviarEmail: false,
      },
    }

    const emitResult = await notarpProvider.emit(emitParams)
    ok('emissão NFS-e NotaRP', emitResult.success, emitResult.errorMessage)
    if (emitResult.success) {
      console.log(`    id_nota: ${emitResult.chaveAcesso}`)

      const cancelResult = await notarpProvider.cancel({
        chaveAcesso: emitResult.chaveAcesso!,
        justificativa: 'Teste automatizado — cancelamento imediato',
        config: notarpConfig,
      })
      ok('cancelamento NFS-e NotaRP', cancelResult.success, cancelResult.errorMessage)
    } else {
      skip('cancelamento NFS-e NotaRP', 'emissão falhou')
      console.log(`    rawResponse: ${JSON.stringify(emitResult.rawResponse).slice(0, 300)}`)
    }
  } else {
    skip('emissão NFS-e NotaRP', 'testConnection falhou')
    skip('cancelamento NFS-e NotaRP', 'testConnection falhou')
  }
}

// ─── CT-e ─────────────────────────────────────────────────────────────────────

if (runCte) {
  section('CT-e 4.00 — build + assinatura (local)')

  const cteConfig: CteConfig = {
    model: 'cte',
    environment: 'homologacao',
    cnpj: env('FISCAL_CNPJ') ?? '11222333000181',
    inscricaoEstadual: env('FISCAL_IE') ?? '111111111111',
    razaoSocial: env('FISCAL_RAZAO') ?? 'TRANSPORTADORA TESTE LTDA',
    uf: env('FISCAL_UF') ?? 'SP',
    municipio: env('FISCAL_MUNICIPIO') ?? 'São Paulo',
    codigoMunicipio: env('FISCAL_CODIGO_MUNICIPIO') ?? '3550308',
    cep: env('FISCAL_CEP') ?? '01310100',
    logradouro: env('FISCAL_LOGRADOURO') ?? 'Av Paulista',
    numero: env('FISCAL_NUMERO') ?? '1000',
    bairro: env('FISCAL_BAIRRO') ?? 'Bela Vista',
    crt: '1',
    certificadoBase64: env('FISCAL_CERT_BASE64') ?? '',
    certificadoSenha: env('FISCAL_CERT_SENHA') ?? '',
    serie: env('FISCAL_SERIE') ?? '001',
    numeroCte: parseInt(env('FISCAL_NUMERO_NF') ?? '1', 10),
    rntrc: env('FISCAL_RNTRC') ?? '00000000',
    telefone: '11999999999',
  }

  const cteData: CteData = {
    cfop: '6353',
    naturezaOperacao: 'PRESTAÇÃO DE SERVIÇO DE TRANSPORTE',
    tipoServico: '0',
    tomador: '3',
    municipioOrigem: { codigo: '3550308', nome: 'São Paulo', uf: 'SP' },
    municipioDestino: { codigo: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
    remetente: {
      cnpj: '11222333000181',
      xNome: 'REMETENTE TESTE LTDA',
      xLgr: 'Rua Teste',
      nro: '1',
      xBairro: 'Centro',
      cMun: '3550308',
      xMun: 'São Paulo',
      uf: 'SP',
      cep: '01001000',
    },
    destinatario: {
      cnpj: '99888777000100',
      xNome: 'DESTINATARIO TESTE LTDA',
      xLgr: 'Rua Destino',
      nro: '200',
      xBairro: 'Flamengo',
      cMun: '3304557',
      xMun: 'Rio de Janeiro',
      uf: 'RJ',
      cep: '22210030',
    },
    valorTotalPrestacao: 500.0,
    valorTotalReceber: 500.0,
    componentesValor: [{ xNome: 'FRETE', vComp: 500.0 }],
    icms: { cst: '40' },
    carga: {
      vCarga: 5000.0,
      proPred: 'CARGA GERAL',
      quantidades: [{ cUnid: '00', tpMed: 'PESO BRUTO', qCarga: 100 }],
    },
    documentos: [{ tipo: 'outros', tpDoc: '00' }],
    modal: {
      modal: '01',
      rntrc: env('FISCAL_RNTRC') ?? '00000000',
    },
  }

  try {
    const { xml, chaveAcesso } = buildCteXml(cteConfig, cteData)
    ok('buildCteXml gera XML', xml.length > 0)
    ok('raiz é <CTe>', xml.includes('<CTe versao="4.00"'))
    ok('elemento <infCTe> (T maiúsculo)', xml.includes('<infCTe Id='))
    ok('fecha </infCTe></CTe>', xml.includes('</infCTe></CTe>'))
    ok('chave 44 dígitos', chaveAcesso.length === 44)
    ok('mod=57 no XML', xml.includes('<mod>57</mod>'))

    if (cteConfig.certificadoBase64) {
      try {
        const certData = loadCertificate(cteConfig.certificadoBase64, cteConfig.certificadoSenha)
        const { signedXml } = signCteXml(xml, certData)
        ok('signCteXml encontra infCTe Id', signedXml.includes('<Signature'))
        ok('XML assinado contém <Signature>', signedXml.includes('<Signature'))
      } catch (err) {
        ok('signCteXml', false, err instanceof Error ? err.message : 'erro desconhecido')
      }
    } else {
      skip('signCteXml', 'FISCAL_CERT_BASE64 não definido')
    }
  } catch (err) {
    ok('buildCteXml', false, err instanceof Error ? err.message : 'erro desconhecido')
    skip('raiz <CTe>', 'buildCteXml falhou')
    skip('elemento <infCTe>', 'buildCteXml falhou')
  }

  section('CT-e 4.00 — testConnection SEFAZ homologação')

  if (cteConfig.certificadoBase64) {
    const cteProvider = createFiscalProvider({ model: 'cte', ...cteConfig } as CteConfig)
    const connResult = await cteProvider.testConnection({ config: cteConfig })
    ok('SEFAZ CT-e SP homologação cStat 107', connResult.ok, connResult.message)
    if (connResult.ok) console.log(`    ${connResult.message}`)
  } else {
    skip('testConnection CT-e SEFAZ', 'FISCAL_CERT_BASE64 não definido')
  }
}

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`)
console.log(`  ✓ ${passed} passou    ✗ ${failed} falhou    ○ ${skipped} pulado`)
console.log(`${'─'.repeat(48)}\n`)

if (failed > 0) process.exit(1)
