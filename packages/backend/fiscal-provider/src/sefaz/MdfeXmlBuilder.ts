import { randomInt } from 'crypto'

import type {
  MdfeConfig,
  MdfeData,
  MdfeMunicipioDescarga,
  MdfeProprietarioVeiculo,
  MdfeSeguro,
  MdfeVeiculoReboque,
  MdfeVeiculoTracao,
} from '../types'
import { UF_IBGE_CODES_CTE } from './CteConstants'
import { getMdfeQrCodeUrl, MDFE_MODELO, MDFE_NS, MDFE_VERSAO } from './MdfeConstants'
import { formatDhEmi, toBrasiliaWallClock } from './SefazDateTime'

// O MDF-e só trata carga rodoviária neste provider — modal é 1 dígito, ao contrário dos 2 do CT-e
const MODAL_RODOVIARIO = '1'
const TP_EMIS_NORMAL = '1'
const PROC_EMI_APLICATIVO_CONTRIBUINTE = '0'
const VER_PROC = 'fiscal-provider@1.0'

// ─── Chave de acesso ──────────────────────────────────────────────────────────

function calcDigitoVerificador(chave43: string): string {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9]
  let sum = 0
  let wi = 0
  for (let i = chave43.length - 1; i >= 0; i--) {
    sum += parseInt(chave43[i]!, 10) * weights[wi % 8]!
    wi++
  }
  const remainder = sum % 11
  return remainder < 2 ? '0' : String(11 - remainder)
}

function buildChaveMdfe(params: {
  cUF: string
  dhEmi: Date
  cnpj: string
  serie: string
  nMDF: number
  tpEmis: string
}): string {
  const wallClock = toBrasiliaWallClock(params.dhEmi)
  const aamm = `${wallClock.getUTCFullYear().toString().slice(2)}${String(wallClock.getUTCMonth() + 1).padStart(2, '0')}`
  const cnpjClean = params.cnpj.replace(/\D/g, '').padStart(14, '0')
  const serieStr = String(parseInt(params.serie, 10)).padStart(3, '0')
  const nMDFStr = String(params.nMDF).padStart(9, '0')
  const cMDF = String(randomInt(1, 99999999)).padStart(8, '0')
  const chave43 = `${params.cUF}${aamm}${cnpjClean}${MDFE_MODELO}${serieStr}${nMDFStr}${params.tpEmis}${cMDF}`
  return `${chave43}${calcDigitoVerificador(chave43)}`
}

// ─── Modal rodoviário ─────────────────────────────────────────────────────────

function buildProprietario(prop: MdfeProprietarioVeiculo): string {
  const doc = prop.cnpj ? `<CNPJ>${prop.cnpj.replace(/\D/g, '')}</CNPJ>` : `<CPF>${prop.cpf!.replace(/\D/g, '')}</CPF>`
  const ie = prop.inscricaoEstadual && prop.uf ? `<IE>${prop.inscricaoEstadual}</IE><UF>${prop.uf}</UF>` : ''
  return `<prop>${doc}<RNTRC>${prop.rntrc}</RNTRC><xNome>${prop.nome}</xNome>${ie}<tpProp>${prop.tipoProprietario}</tpProp></prop>`
}

function buildVeiculoTracao(veiculo: MdfeVeiculoTracao): string {
  const cInt = veiculo.codigoInterno ? `<cInt>${veiculo.codigoInterno}</cInt>` : ''
  const renavam = veiculo.renavam ? `<RENAVAM>${veiculo.renavam}</RENAVAM>` : ''
  const capKG = veiculo.capacidadeKg !== undefined ? `<capKG>${veiculo.capacidadeKg}</capKG>` : ''
  const capM3 = veiculo.capacidadeM3 !== undefined ? `<capM3>${veiculo.capacidadeM3}</capM3>` : ''
  const prop = veiculo.proprietario ? buildProprietario(veiculo.proprietario) : ''
  const condutores = veiculo.condutores
    .map(
      (condutor) => `<condutor><xNome>${condutor.nome}</xNome><CPF>${condutor.cpf.replace(/\D/g, '')}</CPF></condutor>`,
    )
    .join('')
  const uf = veiculo.uf ? `<UF>${veiculo.uf}</UF>` : ''
  return `<veicTracao>${cInt}<placa>${veiculo.placa}</placa>${renavam}<tara>${veiculo.tara}</tara>${capKG}${capM3}${prop}${condutores}<tpRod>${veiculo.tipoRodado}</tpRod><tpCar>${veiculo.tipoCarroceria}</tpCar>${uf}</veicTracao>`
}

function buildVeiculoReboque(reboque: MdfeVeiculoReboque): string {
  const cInt = reboque.codigoInterno ? `<cInt>${reboque.codigoInterno}</cInt>` : ''
  const renavam = reboque.renavam ? `<RENAVAM>${reboque.renavam}</RENAVAM>` : ''
  const capM3 = reboque.capacidadeM3 !== undefined ? `<capM3>${reboque.capacidadeM3}</capM3>` : ''
  const prop = reboque.proprietario ? buildProprietario(reboque.proprietario) : ''
  const uf = reboque.uf ? `<UF>${reboque.uf}</UF>` : ''
  return `<veicReboque>${cInt}<placa>${reboque.placa}</placa>${renavam}<tara>${reboque.tara}</tara><capKG>${reboque.capacidadeKg}</capKG>${capM3}${prop}<tpCar>${reboque.tipoCarroceria}</tpCar>${uf}</veicReboque>`
}

function buildRodo(data: MdfeData): string {
  const infANTT = data.rntrc ? `<infANTT><RNTRC>${data.rntrc}</RNTRC></infANTT>` : ''
  const reboques = (data.reboques ?? []).map(buildVeiculoReboque).join('')
  return `<rodo>${infANTT}${buildVeiculoTracao(data.veiculoTracao)}${reboques}</rodo>`
}

// ─── Documentos manifestados ──────────────────────────────────────────────────

function buildMunicipioDescarga(municipio: MdfeMunicipioDescarga): string {
  const ctes = (municipio.chavesCte ?? []).map((chave) => `<infCTe><chCTe>${chave}</chCTe></infCTe>`).join('')
  const nfes = (municipio.chavesNfe ?? []).map((chave) => `<infNFe><chNFe>${chave}</chNFe></infNFe>`).join('')
  const mdfes = (municipio.chavesMdfe ?? [])
    .map((chave) => `<infMDFeTransp><chMDFe>${chave}</chMDFe></infMDFeTransp>`)
    .join('')
  return `<infMunDescarga><cMunDescarga>${municipio.codigo}</cMunDescarga><xMunDescarga>${municipio.nome}</xMunDescarga>${ctes}${nfes}${mdfes}</infMunDescarga>`
}

function countDocumentos(data: MdfeData): { qCTe: number; qNFe: number; qMDFe: number } {
  return data.municipiosDescarga.reduce(
    (total, municipio) => ({
      qCTe: total.qCTe + (municipio.chavesCte?.length ?? 0),
      qNFe: total.qNFe + (municipio.chavesNfe?.length ?? 0),
      qMDFe: total.qMDFe + (municipio.chavesMdfe?.length ?? 0),
    }),
    { qCTe: 0, qNFe: 0, qMDFe: 0 },
  )
}

// ─── Seguro ───────────────────────────────────────────────────────────────────

function buildSeguro(seguro: MdfeSeguro): string {
  const responsavelDoc = seguro.responsavelCnpj
    ? `<CNPJ>${seguro.responsavelCnpj.replace(/\D/g, '')}</CNPJ>`
    : seguro.responsavelCpf
      ? `<CPF>${seguro.responsavelCpf.replace(/\D/g, '')}</CPF>`
      : ''
  const seguradora = seguro.seguradora
    ? `<infSeg><xSeg>${seguro.seguradora.nome}</xSeg><CNPJ>${seguro.seguradora.cnpj.replace(/\D/g, '')}</CNPJ></infSeg>`
    : ''
  const apolice = seguro.apolice ? `<nApol>${seguro.apolice}</nApol>` : ''
  const averbacoes = (seguro.averbacoes ?? []).map((averbacao) => `<nAver>${averbacao}</nAver>`).join('')
  return `<seg><infResp><respSeg>${seguro.responsavel}</respSeg>${responsavelDoc}</infResp>${seguradora}${apolice}${averbacoes}</seg>`
}

// ─── Builder principal ────────────────────────────────────────────────────────

export type BuiltMdfeXml = {
  readonly xml: string
  readonly chaveAcesso: string
  readonly cMDF: string
}

export function buildMdfeXml(config: MdfeConfig, data: MdfeData, now: Date = new Date()): BuiltMdfeXml {
  const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
  const tpAmb = config.environment === 'producao' ? '1' : '2'
  const chave = buildChaveMdfe({
    cUF,
    dhEmi: now,
    cnpj: config.cnpj,
    serie: config.serie,
    nMDF: config.numeroMdfe,
    tpEmis: TP_EMIS_NORMAL,
  })

  const cMDF = chave.slice(35, 43)
  const cDV = chave.slice(43)
  // TSerie/TNF não aceitam zeros à esquerda — o zero-padding só vale dentro da chave de acesso
  const serie = String(parseInt(config.serie, 10))
  const nMDF = String(config.numeroMdfe)

  const tpTransp = data.tipoTransportador ? `<tpTransp>${data.tipoTransportador}</tpTransp>` : ''
  const municipiosCarregamento = data.municipiosCarregamento
    .map(
      (municipio) =>
        `<infMunCarrega><cMunCarrega>${municipio.codigo}</cMunCarrega><xMunCarrega>${municipio.nome}</xMunCarrega></infMunCarrega>`,
    )
    .join('')
  const percurso = (data.ufsPercurso ?? []).map((uf) => `<infPercurso><UFPer>${uf}</UFPer></infPercurso>`).join('')
  const dhIniViagem = data.dataInicioViagem ? `<dhIniViagem>${data.dataInicioViagem}</dhIniViagem>` : ''

  const ide = `<ide><cUF>${cUF}</cUF><tpAmb>${tpAmb}</tpAmb><tpEmit>${data.tipoEmitente}</tpEmit>${tpTransp}<mod>${MDFE_MODELO}</mod><serie>${serie}</serie><nMDF>${nMDF}</nMDF><cMDF>${cMDF}</cMDF><cDV>${cDV}</cDV><modal>${MODAL_RODOVIARIO}</modal><dhEmi>${formatDhEmi(now)}</dhEmi><tpEmis>${TP_EMIS_NORMAL}</tpEmis><procEmi>${PROC_EMI_APLICATIVO_CONTRIBUINTE}</procEmi><verProc>${VER_PROC}</verProc><UFIni>${data.ufInicio}</UFIni><UFFim>${data.ufFim}</UFFim>${municipiosCarregamento}${percurso}${dhIniViagem}</ide>`

  const complemento = config.complemento ? `<xCpl>${config.complemento}</xCpl>` : ''
  const fone = config.telefone ? `<fone>${config.telefone.replace(/\D/g, '')}</fone>` : ''
  const emit = `<emit><CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ><IE>${config.inscricaoEstadual || 'ISENTO'}</IE><xNome>${config.razaoSocial}</xNome><enderEmit><xLgr>${config.logradouro}</xLgr><nro>${config.numero}</nro>${complemento}<xBairro>${config.bairro}</xBairro><cMun>${config.codigoMunicipio}</cMun><xMun>${config.municipio}</xMun><CEP>${config.cep.replace(/\D/g, '')}</CEP><UF>${config.uf}</UF>${fone}</enderEmit></emit>`

  // O schema exige versaoModal em infModal — versao é rejeitado com cStat 215
  const infModal = `<infModal versaoModal="${MDFE_VERSAO}">${buildRodo(data)}</infModal>`
  const infDoc = `<infDoc>${data.municipiosDescarga.map(buildMunicipioDescarga).join('')}</infDoc>`
  const seg = data.seguro ? buildSeguro(data.seguro) : ''

  const prodPred = data.produtoPredominante
    ? `<prodPred><tpCarga>${data.produtoPredominante.tipoCarga}</tpCarga><xProd>${data.produtoPredominante.descricao}</xProd>${data.produtoPredominante.ncm ? `<NCM>${data.produtoPredominante.ncm}</NCM>` : ''}</prodPred>`
    : ''

  const { qCTe, qNFe, qMDFe } = countDocumentos(data)
  const quantidades = [
    qCTe > 0 ? `<qCTe>${qCTe}</qCTe>` : '',
    qNFe > 0 ? `<qNFe>${qNFe}</qNFe>` : '',
    qMDFe > 0 ? `<qMDFe>${qMDFe}</qMDFe>` : '',
  ].join('')
  // vCarga é TDec_1302 (2 casas) e qCarga é TDec_1104 (4 casas) — o schema exige a precisão exata
  const tot = `<tot>${quantidades}<vCarga>${data.totais.vCarga.toFixed(2)}</vCarga><cUnid>${data.totais.cUnid}</cUnid><qCarga>${data.totais.qCarga.toFixed(4)}</qCarga></tot>`

  const lacres = (data.lacres ?? []).map((lacre) => `<lacres><nLacre>${lacre}</nLacre></lacres>`).join('')
  const infAdFisco = data.informacoesFisco ? `<infAdFisco>${data.informacoesFisco}</infAdFisco>` : ''
  const infCpl = data.informacoesAdicionais ? `<infCpl>${data.informacoesAdicionais}</infCpl>` : ''
  const infAdic = infAdFisco || infCpl ? `<infAdic>${infAdFisco}${infCpl}</infAdic>` : ''

  // O QR Code fica em infMDFeSupl, irmão de infMDFe, entre ele e a assinatura.
  // A URL vai em CDATA porque o & do separador de parâmetros não é escapado pelo validador da SVRS.
  const qrCodMDFe = `${getMdfeQrCodeUrl()}?chMDFe=${chave}&tpAmb=${tpAmb}`
  const infMDFeSupl = `<infMDFeSupl><qrCodMDFe><![CDATA[${qrCodMDFe}]]></qrCodMDFe></infMDFeSupl>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?><MDFe xmlns="${MDFE_NS}"><infMDFe versao="${MDFE_VERSAO}" Id="MDFe${chave}">${ide}${emit}${infModal}${infDoc}${seg}${prodPred}${tot}${lacres}${infAdic}</infMDFe>${infMDFeSupl}</MDFe>`

  return { xml, chaveAcesso: chave, cMDF }
}
