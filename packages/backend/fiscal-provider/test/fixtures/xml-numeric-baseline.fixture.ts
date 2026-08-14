/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

/**
 * Linha de base do XML gerado para CNPJ **numérico**, congelada antes de qualquer mudança nos
 * builders pela spec 037 (CNPJ alfanumérico). O acervo existente é todo numérico: se um caractere
 * destes documentos mudar durante a fase A, a mudança quebrou o que já funcionava.
 *
 * ⚠️ Regenerar a constante para fazer o teste passar é anular o teste. O golden só muda junto com
 * uma decisão registrada em `transportada/specs/037-cnpj-alfanumerico/evidence.md`.
 */

import type { CteConfig, CteData, EmitFiscalParams, MdfeConfig, MdfeData, NfeConfig, NfeData } from '../../src/types'

export const BASELINE_CNPJ = '11222333000181'
export const BASELINE_RECIPIENT_CNPJ = '99888777000100'

/** Emissão fixa: sem isso `dhEmi` e o AAMM da chave mudam a cada execução. */
export const BASELINE_EMISSION_DATE = new Date('2026-08-14T18:30:00.000Z')

/**
 * `cNF`/`cCT`/`cMDF` são aleatórios por exigência do manual, e o DV depende deles. Só essas duas
 * posições saem do golden — as 35 primeiras posições da chave, onde o CNPJ mora, permanecem
 * literais.
 */
export function maskRandomCode(xml: string, chaveAcesso: string): string {
  const randomCode = chaveAcesso.slice(35, 43)
  const checkDigit = chaveAcesso.slice(43)

  return xml
    .replaceAll(chaveAcesso, `${chaveAcesso.slice(0, 35)}«RND»«DV»`)
    .replaceAll(`<cNF>${randomCode}</cNF>`, '<cNF>«RND»</cNF>')
    .replaceAll(`<cCT>${randomCode}</cCT>`, '<cCT>«RND»</cCT>')
    .replaceAll(`<cMDF>${randomCode}</cMDF>`, '<cMDF>«RND»</cMDF>')
    .replaceAll(`<cDV>${checkDigit}</cDV>`, '<cDV>«DV»</cDV>')
}

export function buildBaselineNfeConfig(): NfeConfig {
  return {
    model: 'nfe',
    environment: 'homologacao' as NfeConfig['environment'],
    cnpj: BASELINE_CNPJ,
    inscricaoEstadual: '111111111111',
    razaoSocial: 'TRANSPORTADORA TESTE LTDA',
    uf: 'SP',
    municipio: 'Sao Paulo',
    codigoMunicipio: '3550308',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64: 'unused',
    certificadoSenha: 'unused',
    serie: '1',
    numeroNf: 1,
  }
}

export function buildBaselineNfeData(): NfeData {
  return {
    destinatario: {
      cnpj: BASELINE_RECIPIENT_CNPJ,
      xNome: 'DESTINATARIO TESTE LTDA',
      codigoMunicipio: '3304557',
      cep: '22210030',
      logradouro: 'Rua Destino',
      numero: '200',
      bairro: 'Flamengo',
      municipio: 'Rio de Janeiro',
      uf: 'RJ',
      indicadorIe: '9',
    },
    informacoesAdicionais: 'LINHA DE BASE 037',
  }
}

export function buildBaselineEmitParams(config: NfeConfig, nfeData: NfeData): EmitFiscalParams {
  return {
    referenceId: 'baseline-037',
    items: [
      {
        codigo: 'PROD-1',
        descricao: 'PRODUTO DE TESTE',
        ncm: '84713012',
        cfop: '6102',
        cst: '500',
        unidade: 'UN',
        quantidade: 2,
        valorUnitario: 250,
        valorTotal: 500,
      },
    ],
    payments: [{ method: 'pix', amount: 500 }],
    totalAmount: 500,
    discountAmount: 0,
    config,
    nfeData,
  }
}

export function buildBaselineCteConfig(): CteConfig {
  return {
    model: 'cte',
    environment: 'homologacao' as CteConfig['environment'],
    cnpj: BASELINE_CNPJ,
    inscricaoEstadual: '111111111111',
    razaoSocial: 'TRANSPORTADORA TESTE LTDA',
    uf: 'SP',
    municipio: 'Sao Paulo',
    codigoMunicipio: '3550308',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64: 'unused',
    certificadoSenha: 'unused',
    serie: '1',
    numeroCte: 1,
    rntrc: '00000000',
  }
}

export function buildBaselineCteData(): CteData {
  return {
    cfop: '6353',
    naturezaOperacao: 'PRESTACAO DE SERVICO DE TRANSPORTE',
    tipoServico: '0',
    tomador: '3',
    municipioOrigem: { codigo: '3550308', nome: 'Sao Paulo', uf: 'SP' },
    municipioDestino: { codigo: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
    remetente: {
      cnpj: BASELINE_CNPJ,
      xNome: 'REMETENTE TESTE LTDA',
      xLgr: 'Rua Teste',
      nro: '1',
      xBairro: 'Centro',
      cMun: '3550308',
      xMun: 'Sao Paulo',
      uf: 'SP',
      cep: '01001000',
    },
    destinatario: {
      cnpj: BASELINE_RECIPIENT_CNPJ,
      xNome: 'DESTINATARIO TESTE LTDA',
      xLgr: 'Rua Destino',
      nro: '200',
      xBairro: 'Flamengo',
      cMun: '3304557',
      xMun: 'Rio de Janeiro',
      uf: 'RJ',
      cep: '22210030',
    },
    valorTotalPrestacao: 500,
    valorTotalReceber: 500,
    componentesValor: [{ xNome: 'FRETE', vComp: 500 }],
    icms: { cst: '40' },
    carga: {
      vCarga: 5000,
      proPred: 'CARGA GERAL',
      quantidades: [{ cUnid: '00', tpMed: 'PESO BRUTO', qCarga: 100 }],
    },
    documentos: [{ tipo: 'outro', tpDoc: '00' }],
    modal: { modal: '01', rntrc: '00000000' },
  }
}

export function buildBaselineMdfeConfig(): MdfeConfig {
  return {
    model: 'mdfe',
    environment: 'homologacao' as MdfeConfig['environment'],
    cnpj: BASELINE_CNPJ,
    inscricaoEstadual: '111111111111',
    razaoSocial: 'TRANSPORTADORA TESTE LTDA',
    uf: 'SP',
    municipio: 'Sao Paulo',
    codigoMunicipio: '3550308',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    crt: '1',
    certificadoBase64: 'unused',
    certificadoSenha: 'unused',
    serie: '1',
    numeroMdfe: 1,
  }
}

export function buildBaselineMdfeData(): MdfeData {
  return {
    tipoEmitente: '1',
    tipoTransportador: '1',
    ufInicio: 'SP',
    ufFim: 'RJ',
    municipiosCarregamento: [{ codigo: '3550308', nome: 'Sao Paulo' }],
    municipiosDescarga: [
      {
        codigo: '3304557',
        nome: 'Rio de Janeiro',
        chavesCte: ['35260711222333000181570010000000011000000010'],
        chavesNfe: ['35260711222333000181550010000000011000000013'],
      },
    ],
    produtoPredominante: { tipoCarga: '05', descricao: 'CARGA GERAL' },
    totais: { vCarga: 5000, cUnid: '01', qCarga: 100 },
    rntrc: '12345678',
    veiculoTracao: {
      codigoInterno: '1',
      placa: 'ABC1D23',
      renavam: '12345678901',
      tara: 7500,
      capacidadeKg: 25000,
      tipoRodado: '03',
      tipoCarroceria: '02',
      uf: 'SP',
      condutores: [{ nome: 'MOTORISTA TESTE', cpf: '12345678909' }],
    },
    informacoesAdicionais: 'MANIFESTO DE TESTE',
  }
}
