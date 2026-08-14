/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { buildDanfce } from '../../src/danfce/DanfceBuilder'
import { gerarCupomTermico } from '../../src/providers/controlid-cupom'
import { obfuscateMeta } from '../../src/sefaz/LogObfuscator'
import type { FiscalResult, NfceConfig } from '../../src/types'
import {
  BASELINE_EMISSION_DATE,
  buildBaselineEmitParams,
  buildBaselineNfeConfig,
  buildBaselineNfeData,
} from '../fixtures/xml-numeric-baseline.fixture'

/**
 * Duas classes de defeito no mesmo lugar. Na redação de log, `<CNPJ>` alfanumérico **não casava**
 * com `\d{14}` e ia inteiro para o log — vazamento. Nas máscaras de impressão, o
 * `replace(/\D/g,'')` produzia um CNPJ de 9 posições e o cupom saía com documento errado na cara do
 * consumidor. Uma vaza, a outra mente; as duas em silêncio.
 */

const CNPJ = '12ABC34501DE35'
const CHAVE = '35260712ABC34501DE35550010000000011000000014'

describe('redação de log', () => {
  test('CNPJ alfanumérico é mascarado sem virar um borrão', () => {
    const masked = obfuscateMeta({ cnpj: CNPJ })['cnpj']

    expect(masked).not.toBe('**masked**')
    expect(masked).not.toContain('ABC')
    expect(String(masked).startsWith('12')).toBe(true)
  })

  test('chave alfanumérica mantém prefixo e sufixo de rastreio', () => {
    const masked = String(obfuscateMeta({ chaveAcesso: CHAVE })['chaveAcesso'])

    expect(masked).not.toBe('**masked**')
    expect(masked).toBe('352607...0014')
  })

  test('CNPJ alfanumérico dentro de rawResponse não chega ao log', () => {
    const rawResponse = `<retConsSitNFe><CNPJ>${CNPJ}</CNPJ><xNome>TRANSPORTADORA TESTE</xNome></retConsSitNFe>`

    const masked = String(obfuscateMeta({ rawResponse })['rawResponse'])

    expect(masked).not.toContain(CNPJ)
    expect(masked).toContain('<CNPJ>**masked**</CNPJ>')
  })

  test('CNPJ e CPF numéricos continuam mascarados como antes', () => {
    expect(obfuscateMeta({ cnpj: '11222333000181' })['cnpj']).toBe('11****0001-**')
    expect(obfuscateMeta({ cpf: '12345678901' })['cpf']).toBe('123.***.***-**')
    expect(String(obfuscateMeta({ rawResponse: '<CNPJ>11222333000181</CNPJ>' })['rawResponse'])).toBe(
      '<CNPJ>**masked**</CNPJ>',
    )
  })

  test('valor que não é documento continua virando borrão — a guarda não afrouxou', () => {
    expect(obfuscateMeta({ cnpj: 'nao-e-cnpj' })['cnpj']).toBe('**masked**')
    expect(obfuscateMeta({ chaveAcesso: '123' })['chaveAcesso']).toBe('**masked**')
  })
})

describe('máscara de impressão do DANFE NFC-e', () => {
  test('o cupom imprime o CNPJ alfanumérico inteiro e pontuado', () => {
    const nfeConfig = buildBaselineNfeConfig()
    const config: NfceConfig = {
      ...nfeConfig,
      model: 'nfce',
      cnpj: CNPJ,
      cscToken: 'unused',
      cscId: '000001',
    }
    const result: FiscalResult = { success: true, chaveAcesso: CHAVE, rawResponse: null }

    const danfce = buildDanfce({
      emitParams: buildBaselineEmitParams(nfeConfig, buildBaselineNfeData()),
      config,
      result,
      qrCodeUrl: 'https://exemplo/qr',
      urlConsulta: 'https://exemplo/consulta',
      dataEmissao: BASELINE_EMISSION_DATE,
    })

    expect(danfce.text).toContain('12.ABC.345/01DE-35')
  })

  test('o cupom térmico do Control-ID imprime o mesmo CNPJ', () => {
    const cupom = gerarCupomTermico({
      cnpj: CNPJ,
      razaoSocial: 'TRANSPORTADORA TESTE LTDA',
      inscricaoEstadual: '110042490114',
      endereco: {
        logradouro: 'Avenida Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        municipio: 'Sao Paulo',
        cep: '01310100',
        uf: 'SP',
      },
      itens: [{ codigo: '001', descricao: 'PRODUTO DE TESTE', quantidade: 2, valorUnitario: 250 }],
      pagamentos: [{ metodo: 'PIX', valor: 500 }],
      valorTotal: 500,
    })

    expect(cupom).toContain('12.ABC.345/01DE-35')
  })
})
