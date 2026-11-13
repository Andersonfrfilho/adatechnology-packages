#!/usr/bin/env bun
/**
 * Exemplo Completo: Emitir Cupom Fiscal SAT com QR Code
 *
 * Uso:
 *   bun run scripts/exemplo-cupom-sat.ts
 */

import {
  gerarCupomTermico,
  gerarCupomCompleto,
  type CupomFiscalData,
  type CupomItemData,
  type CupomPagamento,
} from '../src/providers/controlid-cupom'
import {
  gerarCupomComQRCode,
  gerarQRCodeASCII,
  type QRCodeData,
} from '../src/providers/controlid-qrcode'

// ════════════════════════════════════════════════════════════════════════════
// 1. DADOS DO CUPOM FISCAL
// ════════════════════════════════════════════════════════════════════════════

const dadosCupom: CupomFiscalData = {
  // Estabelecimento (AFR Fernandes)
  cnpj: '61156864000191',
  razaoSocial: 'AFR FERNANDES TRANSPORTES E SERVICOS LTDA',
  nomeFantasia: 'AFR Transportes',
  inscricaoEstadual: '123.456.789.012',
  endereco: {
    logradouro: 'Rua Funchal',
    numero: '500',
    complemento: 'Loja 1',
    bairro: 'Vila Olimpia',
    municipio: 'Ribeirão Preto',
    cep: '14090-160',
    uf: 'SP',
  },
  telefone: '(16) 3636-8000',
  email: 'vendas@afrfernandes.com.br',

  // Itens do cupom
  itens: [
    {
      codigo: 'PROD001',
      descricao: 'Diesel S500',
      quantidade: 50,
      valorUnitario: 6.50,
      ncm: '27101990',
      cfop: '5102',
      unidade: 'L',
    } as CupomItemData,
    {
      codigo: 'PROD002',
      descricao: 'Gasolina Comum',
      quantidade: 30,
      valorUnitario: 5.89,
      ncm: '27101990',
      cfop: '5102',
      unidade: 'L',
    } as CupomItemData,
    {
      codigo: 'SERV001',
      descricao: 'Serviço de Abastecimento',
      quantidade: 1,
      valorUnitario: 25.00,
      ncm: '85183000',
      cfop: '5190',
      unidade: 'UN',
    } as CupomItemData,
  ],

  // Pagamentos
  pagamentos: [
    {
      metodo: 'PIX',
      valor: 350.00,
      descricao: 'Pagamento via PIX',
    } as CupomPagamento,
    {
      metodo: 'DINHEIRO',
      valor: 157.50,
      descricao: 'Pagamento em espécie',
    } as CupomPagamento,
  ],

  // Totalizações
  valorSubtotal: 507.50,
  valorDesconto: 0,
  valorTotal: 507.50,
  valorTroco: 0,

  // Adicionais
  cpfCliente: '12345678901',
  observacoes: 'Obrigado pelo transporte!',
  condicaoPagamento: 'À vista',
}

// ════════════════════════════════════════════════════════════════════════════
// 2. DADOS DO QR CODE
// ════════════════════════════════════════════════════════════════════════════

const chaveAcesso = '35260661156864000191550010000000091528920846'

const dadosQRCode: QRCodeData = {
  chaveAcesso,
  cnpj: dadosCupom.cnpj,
  dataEmissao: new Date().toLocaleDateString('pt-BR').replace(/\//g, ''),
  valorTotal: dadosCupom.valorTotal.toFixed(2),
  cpfConsumidor: dadosCupom.cpfCliente,
  assinatura: 'ASSINATURATESTE123',
  ambiente: '2', // Homologação
}

// ════════════════════════════════════════════════════════════════════════════
// 3. GERAR CUPOM
// ════════════════════════════════════════════════════════════════════════════

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    EXEMPLO COMPLETO: CUPOM FISCAL SAT                     ║
╚════════════════════════════════════════════════════════════════════════════╝
`)

// Gerar cupom formatado para impressora
const cupomTermico = gerarCupomTermico(dadosCupom)

console.log('📋 CUPOM FORMATADO PARA IMPRESSORA (80mm):')
console.log('━'.repeat(80))
console.log(cupomTermico)
console.log('━'.repeat(80))

// Gerar cupom com QR Code
const cupomComQR = gerarCupomComQRCode(cupomTermico, dadosQRCode)

console.log('\n📱 QR CODE (ASCII ART):')
console.log('━'.repeat(80))
console.log(cupomComQR.qrCodeASCII)
console.log('━'.repeat(80))

console.log('\n🔗 URL DO QR CODE (para gerar dinamicamente):')
console.log(cupomComQR.urlQRCode)

console.log('\n📊 DADOS CODIFICADOS NO QR CODE:')
console.log(cupomComQR.dadosQRCode)

console.log('\n💾 XML DO CUPOM FISCAL:')
console.log('━'.repeat(80))
const cupomCompleto = gerarCupomCompleto(dadosCupom, chaveAcesso, '000042', '1')
console.log(cupomCompleto.xmlCupom.substring(0, 500) + '...\n')

// ════════════════════════════════════════════════════════════════════════════
// 4. LOG ESTRUTURADO (Como ficaria no banco de dados)
// ════════════════════════════════════════════════════════════════════════════

console.log('\n📝 REGISTRO ESTRUTURADO (JSON para banco de dados):')
console.log('━'.repeat(80))

const registroCupom = {
  id: `cupom_${Date.now()}`,
  modelo: 'SAT',
  chaveAcesso,
  numero: cupomCompleto.numero,
  serie: cupomCompleto.serie,
  dataEmissao: cupomCompleto.dataEmissao,
  emitente: {
    cnpj: dadosCupom.cnpj,
    razaoSocial: dadosCupom.razaoSocial,
    nomeFantasia: dadosCupom.nomeFantasia,
  },
  cliente: {
    cpf: dadosCupom.cpfCliente,
  },
  itens: dadosCupom.itens.map((item, idx) => ({
    numero: idx + 1,
    codigo: item.codigo,
    descricao: item.descricao,
    quantidade: item.quantidade,
    valorUnitario: item.valorUnitario,
    valorTotal: item.quantidade * item.valorUnitario,
  })),
  totalizacao: {
    subtotal: dadosCupom.valorSubtotal,
    desconto: dadosCupom.valorDesconto,
    total: dadosCupom.valorTotal,
  },
  pagamentos: dadosCupom.pagamentos.map((pag) => ({
    metodo: pag.metodo,
    valor: pag.valor,
  })),
  qrcode: {
    chaveAcesso: dadosQRCode.chaveAcesso,
    url: cupomComQR.urlQRCode,
    dados: cupomComQR.dadosQRCode,
  },
  xmlCupom: cupomCompleto.xmlCupom,
  status: 'EMITIDO',
}

console.log(JSON.stringify(registroCupom, null, 2))

// ════════════════════════════════════════════════════════════════════════════
// 5. EXEMPLO DE INTEGRAÇÃO COM NESTJS
// ════════════════════════════════════════════════════════════════════════════

console.log('\n\n💻 CÓDIGO NESTJS PARA EMITIR ESTE CUPOM:')
console.log('━'.repeat(80))

const codigoNestJS = `
// sat.controller.ts
@Post('cupom')
async emitirCupom(@Body() dto: CupomDTO) {
  const result = await this.satService.emitir({
    itens: dto.itens.map(i => ({
      codigo: i.codigo,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      ncm: i.ncm,
      cfop: i.cfop,
    })),
    pagamentos: dto.pagamentos.map(p => ({
      metodo: p.metodo,
      valor: p.valor,
    })),
    totalAmount: dto.total,
    discountAmount: 0,
    config: this.satConfig,
  })

  // Gerar cupom formatado
  const cupom = gerarCupomTermico(dadosCupom)
  const cupomComQR = gerarCupomComQRCode(cupom, {
    chaveAcesso: result.chaveAcesso,
    cnpj: this.satConfig.cnpj,
    dataEmissao: new Date().toLocaleDateString('pt-BR').replace(/\\//g, ''),
    valorTotal: dto.total.toFixed(2),
  })

  // Salvar no banco
  await this.cupomRepository.save({
    chaveAcesso: result.chaveAcesso,
    numero: result.numeroDocumento,
    cupomImpresso: cupomComQR.cupomImpresso,
    qrCodeUrl: cupomComQR.urlQRCode,
    xmlCupom: result.xmlAutorizado,
  })

  return {
    success: true,
    chaveAcesso: result.chaveAcesso,
    cupom: cupomComQR.cupomImpresso,
    qrCode: cupomComQR.urlQRCode,
  }
}
`

console.log(codigoNestJS)

// ════════════════════════════════════════════════════════════════════════════
// 6. RESUMO FINAL
// ════════════════════════════════════════════════════════════════════════════

console.log('\n\n✅ RESUMO:')
console.log('━'.repeat(80))
console.log(`
✓ Cupom gerado com ${dadosCupom.itens.length} itens
✓ Total: R$ ${dadosCupom.valorTotal.toFixed(2)}
✓ Chave de acesso: ${chaveAcesso}
✓ Cupom formatado para impressora térmica 80mm
✓ QR Code gerado (URL + dados codificados)
✓ XML armazenado
✓ Pronto para armazenar em banco de dados

📦 Arquivos a usar:
  - src/providers/controlid-cupom.ts     → Geração de cupom
  - src/providers/controlid-qrcode.ts    → Geração de QR Code
  - Exemplo integrado em: scripts/exemplo-cupom-sat.ts
`)
