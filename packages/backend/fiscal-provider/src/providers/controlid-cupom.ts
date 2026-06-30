/**
 * Gerador de Cupom Fiscal Eletrônico (CF-e)
 * Para Control-ID S@T-iD
 *
 * Gera cupons fiscais completos com dados reais e formatação para impressora
 */

export interface CupomItemData {
  /** Código do produto */
  codigo: string

  /** Descrição do produto */
  descricao: string

  /** Quantidade */
  quantidade: number

  /** Valor unitário */
  valorUnitario: number

  /** NCM (Nomenclatura Comum do Mercosul) - 8 dígitos */
  ncm?: string

  /** CFOP (Código Fiscal de Operações) - 4 dígitos */
  cfop?: string

  /** Unidade de medida (UN, KG, L, etc) */
  unidade?: string
}

export interface CupomPagamento {
  /** Forma de pagamento: DINHEIRO, CARTAO_CREDITO, CARTAO_DEBITO, PIX, CHEQUE */
  metodo: 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'PIX' | 'CHEQUE'

  /** Valor do pagamento */
  valor: number

  /** Descrição da forma de pagamento */
  descricao?: string
}

export interface CupomFiscalData {
  // Informações do estabelecimento
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string
  inscricaoEstadual: string
  endereco: {
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    municipio: string
    cep: string
    uf: string
  }
  telefone?: string
  email?: string

  // Informações do cupom
  itens: CupomItemData[]
  pagamentos: CupomPagamento[]

  // Valores
  valorSubtotal?: number
  valorDesconto?: number
  valorTotal: number
  valorTroco?: number

  // Adicionais
  cpfCliente?: string
  observacoes?: string
  condicaoPagamento?: string
}

export interface CupomFormatado {
  /** Cupom formatado para impressora térmica (80mm) */
  cupomTermico: string

  /** Cupom formatado para terminal de ponto de venda */
  cupomPDV: string

  /** XML do cupom (para arquivamento) */
  xmlCupom: string

  /** Chave de acesso (44 dígitos) */
  chaveAcesso: string

  /** Data/hora de emissão */
  dataEmissao: string

  /** Número sequencial do cupom */
  numero: string

  /** Série do cupom */
  serie: string
}

/**
 * Gerar cupom fiscal formatado para impressora térmica
 */
export function gerarCupomTermico(data: CupomFiscalData): string {
  const largura = 48 // Impressora térmica 80mm
  const separador = '='.repeat(largura)
  const linhas: string[] = []

  // Cabeçalho
  linhas.push('')
  linhas.push(centralizarTexto(data.nomeFantasia || data.razaoSocial, largura))
  linhas.push(centralizarTexto(data.razaoSocial, largura))
  linhas.push(separador)

  // CNPJ e endereço
  linhas.push(`CNPJ: ${formatarCNPJ(data.cnpj)}`)
  linhas.push(`IE: ${data.inscricaoEstadual}`)
  linhas.push(`${data.endereco.logradouro}, ${data.endereco.numero}`)
  if (data.endereco.complemento) {
    linhas.push(data.endereco.complemento)
  }
  linhas.push(`${data.endereco.bairro} - ${data.endereco.municipio}`)
  linhas.push(`${data.endereco.cep} - ${data.endereco.uf}`)
  if (data.telefone) linhas.push(`Tel: ${data.telefone}`)
  if (data.email) linhas.push(`Email: ${data.email}`)

  linhas.push(separador)

  // Itens do cupom
  linhas.push('ITEM | DESCRIÇÃO | QTD | V.UNITÁRIO | V.TOTAL')
  linhas.push('-'.repeat(largura))

  data.itens.forEach((item, index) => {
    const numero = (index + 1).toString().padEnd(4)
    const descricao = truncarTexto(item.descricao, 18)
    const qtd = item.quantidade.toFixed(2).padStart(6)
    const vUnit = formatarMoeda(item.valorUnitario).padStart(8)
    const vTotal = formatarMoeda(item.quantidade * item.valorUnitario).padStart(9)

    linhas.push(
      `${numero}| ${descricao.padEnd(18)} | ${qtd} | ${vUnit} | ${vTotal}`
    )
  })

  linhas.push('-'.repeat(largura))

  // Totalizações
  if (data.valorDesconto && data.valorDesconto > 0) {
    const descLabel = 'DESCONTO'
    const descValor = formatarMoeda(data.valorDesconto).padStart(10)
    linhas.push(
      descLabel.padEnd(largura - 10) + descValor
    )
  }

  const subtotalLabel = 'SUBTOTAL'
  const subtotalValor = formatarMoeda(data.valorSubtotal || data.valorTotal).padStart(10)
  linhas.push(
    subtotalLabel.padEnd(largura - 10) + subtotalValor
  )

  linhas.push(separador)

  const totalLabel = 'TOTAL'
  const totalValor = formatarMoeda(data.valorTotal).padStart(10)
  linhas.push(
    totalLabel.padEnd(largura - 10) + totalValor
  )

  // Pagamentos
  linhas.push(separador)
  linhas.push('FORMAS DE PAGAMENTO')
  data.pagamentos.forEach((pag) => {
    const metodo = traduzirMetodoPagamento(pag.metodo)
    const valor = formatarMoeda(pag.valor).padStart(10)
    linhas.push(
      metodo.padEnd(largura - 10) + valor
    )
  })

  // Troco
  if (data.valorTroco && data.valorTroco > 0) {
    linhas.push(separador)
    const trocoLabel = 'TROCO'
    const trocoValor = formatarMoeda(data.valorTroco).padStart(10)
    linhas.push(
      trocoLabel.padEnd(largura - 10) + trocoValor
    )
  }

  // Rodapé
  linhas.push(separador)
  linhas.push(centralizarTexto('OBRIGADO PELA COMPRA!', largura))
  if (data.observacoes) {
    linhas.push('')
    linhas.push(centralizarTexto(data.observacoes, largura))
  }
  linhas.push('')
  linhas.push('')

  return linhas.join('\n')
}

/**
 * Gerar XML do cupom fiscal (CF-e)
 */
export function gerarXMLCupom(data: CupomFiscalData, chaveAcesso: string): string {
  const dataAgora = new Date()
  const dataStr = dataAgora.toISOString().split('T')[0]
  const horaStr = dataAgora.toTimeString().split(' ')[0]

  const totalItems = data.itens
    .reduce((sum, item) => sum + (item.quantidade * item.valorUnitario), 0)
    .toFixed(2)

  const itemsXml = data.itens
    .map((item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <xProd>${escaparXml(item.descricao)}</xProd>
        <NCM>${item.ncm || '12345678'}</NCM>
        <CFOP>${item.cfop || '5102'}</CFOP>
        <uCom>${item.unidade || 'UN'}</uCom>
        <qCom>${item.quantidade.toFixed(4)}</qCom>
        <vUnCom>${item.valorUnitario.toFixed(2)}</vUnCom>
        <indRegra>A</indRegra>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <Orig>0</Orig>
            <CSOSN>500</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISNT><CST>07</CST></PISNT>
        </PIS>
        <COFINS>
          <COFINSNT><CST>07</CST></COFINSNT>
        </COFINS>
      </imposto>
    </det>`)
    .join('\n')

  const pagamentosXml = data.pagamentos
    .map((pag) => `
    <MP>
      <cMP>${mapearFormaPagamento(pag.metodo)}</cMP>
      <vMP>${pag.valor.toFixed(2)}</vMP>
    </MP>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<CFe>
  <infCFe Id="ID${chaveAcesso}" versaoDadosEnt="0.08">
    <ide>
      <CNPJ>${data.cnpj.replace(/\D/g, '')}</CNPJ>
      <signAC>SGF0b21lMzE5</signAC>
      <numeroCaixa>001</numeroCaixa>
      <dEmi>${dataStr}</dEmi>
      <hEmi>${horaStr}</hEmi>
    </ide>
    <emit>
      <CNPJ>${data.cnpj.replace(/\D/g, '')}</CNPJ>
      <IE>${data.inscricaoEstadual}</IE>
      <indRatISSQN>N</indRatISSQN>
    </emit>
    ${itemsXml}
    <total>
      <vSubtotaling>${totalItems}</vSubtotaling>
      <vTotal>${data.valorTotal.toFixed(2)}</vTotal>
    </total>
    <pgto>
      ${pagamentosXml}
    </pgto>
  </infCFe>
</CFe>`
}

/**
 * Gerar formato completo do cupom
 */
export function gerarCupomCompleto(
  data: CupomFiscalData,
  chaveAcesso: string,
  numero: string = '000001',
  serie: string = '1'
): CupomFormatado {
  const dataAgora = new Date()

  return {
    cupomTermico: gerarCupomTermico(data),
    cupomPDV: gerarCupomTermico(data),
    xmlCupom: gerarXMLCupom(data, chaveAcesso),
    chaveAcesso,
    dataEmissao: dataAgora.toISOString(),
    numero,
    serie,
  }
}

// Utilitários
function centralizarTexto(texto: string, largura: number): string {
  const espacos = Math.max(0, largura - texto.length)
  const espaçoAntes = Math.floor(espacos / 2)
  const espaçoDepois = espacos - espaçoAntes
  return ' '.repeat(espaçoAntes) + texto + ' '.repeat(espaçoDepois)
}

function truncarTexto(texto: string, tamanho: number): string {
  return texto.length > tamanho ? texto.substring(0, tamanho - 3) + '...' : texto
}

function formatarMoeda(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

function formatarCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '')
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(
    8,
    12
  )}-${clean.slice(12)}`
}

function traduzirMetodoPagamento(metodo: string): string {
  const traducoes: Record<string, string> = {
    DINHEIRO: 'Dinheiro',
    CARTAO_CREDITO: 'Cartão de Crédito',
    CARTAO_DEBITO: 'Cartão de Débito',
    PIX: 'PIX',
    CHEQUE: 'Cheque',
  }
  return traducoes[metodo] || metodo
}

function mapearFormaPagamento(metodo: string): string {
  const codigos: Record<string, string> = {
    DINHEIRO: '01',
    CARTAO_CREDITO: '03',
    CARTAO_DEBITO: '04',
    PIX: '05',
    CHEQUE: '10',
  }
  return codigos[metodo] || '01'
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default {
  gerarCupomTermico,
  gerarXMLCupom,
  gerarCupomCompleto,
}
