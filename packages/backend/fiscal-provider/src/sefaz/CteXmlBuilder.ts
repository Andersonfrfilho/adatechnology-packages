import { randomInt } from 'crypto'
import type { CteConfig, CteData, CteParticipante, CteIcms, CteModalData, CteDocumento } from '../types'
import { getCteQrCodeUrl, UF_IBGE_CODES_CTE } from './CteConstants'
import { formatDhEmi, toBrasiliaWallClock } from './SefazDateTime'
import { escapeXml } from './SefazXmlEscape'

const CTE_NS = 'http://www.portalfiscal.inf.br/cte'

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

function buildChaveCte(params: {
  cUF: string
  dhEmi: Date
  cnpj: string
  serie: string
  nCT: number
  tpEmis: string
}): string {
  const { cUF, dhEmi, cnpj, serie, nCT, tpEmis } = params
  const wallClock = toBrasiliaWallClock(dhEmi)
  const aamm = `${wallClock.getUTCFullYear().toString().slice(2)}${String(wallClock.getUTCMonth() + 1).padStart(2, '0')}`
  const cnpjClean = cnpj.replace(/\D/g, '').padStart(14, '0')
  const mod = '57'
  const serieStr = String(parseInt(serie, 10)).padStart(3, '0')
  const nCTStr = String(nCT).padStart(9, '0')
  const cCT = String(randomInt(1, 99999999)).padStart(8, '0')
  const chave43 = `${cUF}${aamm}${cnpjClean}${mod}${serieStr}${nCTStr}${tpEmis}${cCT}`
  const cDV = calcDigitoVerificador(chave43)
  return `${chave43}${cDV}`
}

// ─── Endereço ─────────────────────────────────────────────────────────────────

function buildEnderecoTag(tag: string, p: CteParticipante): string {
  const fone = p.fone ? `<fone>${p.fone.replace(/\D/g, '')}</fone>` : ''
  const email = p.email ? `<email>${escapeXml(p.email)}</email>` : ''
  const cep = p.cep ? `<CEP>${p.cep.replace(/\D/g, '')}</CEP>` : ''
  const cpl = p.xCpl ? `<xCpl>${escapeXml(p.xCpl)}</xCpl>` : ''
  return `<${tag}><xLgr>${escapeXml(p.xLgr)}</xLgr><nro>${escapeXml(p.nro)}</nro>${cpl}<xBairro>${escapeXml(p.xBairro)}</xBairro><cMun>${p.cMun}</cMun><xMun>${escapeXml(p.xMun)}</xMun>${cep}<UF>${p.uf}</UF>${fone}${email}</${tag}>`
}

// ─── Participante ─────────────────────────────────────────────────────────────

// O schema CT-e 4.00 nomeia o endereço do remetente como enderReme, fora do padrão dos demais
const ENDERECO_TAG_POR_PARTICIPANTE: Record<string, string> = {
  rem: 'enderReme',
  exped: 'enderExped',
  receb: 'enderReceb',
  dest: 'enderDest',
}

const HOMOLOGACAO_XNOME_PARTICIPANTE = 'CTE EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'

function buildParticipante(tag: string, p: CteParticipante): string {
  const doc = p.cnpj ? `<CNPJ>${p.cnpj.replace(/\D/g, '')}</CNPJ>` : `<CPF>${p.cpf!.replace(/\D/g, '')}</CPF>`
  const xFant = p.xFant ? `<xFant>${escapeXml(p.xFant)}</xFant>` : ''
  const enderecoTag = ENDERECO_TAG_POR_PARTICIPANTE[tag] ?? `ender${tag.charAt(0).toUpperCase()}${tag.slice(1)}`
  return `<${tag}>${doc}<IE>${p.ie ?? 'ISENTO'}</IE><xNome>${escapeXml(p.xNome)}</xNome>${xFant}${buildEnderecoTag(enderecoTag, p)}</${tag}>`
}

// ─── ICMS ─────────────────────────────────────────────────────────────────────

const SIMPLES_NACIONAL_CRTS = new Set(['1', '2'])

function buildIcms(icms: CteIcms, crt: string): string {
  const fmt = (n: number) => n.toFixed(2)

  // Emitente do Simples Nacional usa o grupo ICMSSN — os demais grupos exigem base de cálculo
  if (SIMPLES_NACIONAL_CRTS.has(crt)) {
    return `<ICMS><ICMSSN><CST>90</CST><indSN>1</indSN></ICMSSN></ICMS>`
  }

  switch (icms.cst) {
    case '00':
      return `<ICMS><ICMS00><CST>00</CST><vBC>${fmt(icms.vBC)}</vBC><pICMS>${fmt(icms.pICMS)}</pICMS><vICMS>${fmt(icms.vICMS)}</vICMS></ICMS00></ICMS>`
    case '20':
      return `<ICMS><ICMS20><CST>20</CST><pRedBC>${fmt(icms.pRedBC)}</pRedBC><vBC>${fmt(icms.vBC)}</vBC><pICMS>${fmt(icms.pICMS)}</pICMS><vICMS>${fmt(icms.vICMS)}</vICMS></ICMS20></ICMS>`
    case '40':
    case '41':
    case '51':
      return `<ICMS><ICMS45><CST>${icms.cst}</CST></ICMS45></ICMS>`
    case '60':
      return `<ICMS><ICMS60><CST>60</CST><vBCSTRet>${fmt(icms.vBCSTRet)}</vBCSTRet><pICMSSTRet>${fmt(icms.pICMSSTRet)}</pICMSSTRet><vICMSSTRet>${fmt(icms.vICMSSTRet)}</vICMSSTRet></ICMS60></ICMS>`
    case '90':
      return `<ICMS><ICMS90><CST>90</CST>${icms.vBC !== undefined ? `<vBC>${fmt(icms.vBC)}</vBC><pICMS>${fmt(icms.pICMS!)}</pICMS><vICMS>${fmt(icms.vICMS!)}</vICMS>` : ''}</ICMS90></ICMS>`
    default:
      return `<ICMS><ICMS45><CST>41</CST></ICMS45></ICMS>`
  }
}

// ─── Documentos vinculados ────────────────────────────────────────────────────

function buildDocumentos(docs: readonly CteDocumento[]): string {
  return docs
    .map((doc) => {
      if (doc.tipo === 'nfe') {
        const peri =
          doc.peri
            ?.map(
              (p) =>
                `<peri><nONU>${p.nONU}</nONU><xNomeAE>${escapeXml(p.xNomeAE)}</xNomeAE><xClaRisco>${escapeXml(p.xClaRisco)}</xClaRisco><grEmb>${p.grEmb}</grEmb><qTotProd>${p.qTotProd}</qTotProd><qVolTipo>${p.qVolTipo}</qVolTipo></peri>`,
            )
            .join('') ?? ''
        const dPrev = doc.dPrev ? `<dPrev>${doc.dPrev}</dPrev>` : ''
        return `<infNFe><chave>${doc.chave}</chave>${doc.pin ? `<PIN>${doc.pin}</PIN>` : ''}${dPrev}${peri}</infNFe>`
      }
      const num = doc.numero ? `<nDoc>${doc.numero}</nDoc>` : ''
      const val = doc.valor !== undefined ? `<vDoc>${doc.valor.toFixed(2)}</vDoc>` : ''
      const dat = doc.data ? `<dEmis>${doc.data}</dEmis>` : ''
      const desc = doc.descOutros ? `<descOutros>${escapeXml(doc.descOutros)}</descOutros>` : ''
      return `<infOutros><tpDoc>${doc.tpDoc}</tpDoc>${desc}${num}${dat}${val}</infOutros>`
    })
    .join('')
}

// ─── Modal rodoviário ─────────────────────────────────────────────────────────

function buildModalRodoviario(modal: Extract<CteModalData, { modal: '01' }>): string {
  const veic = modal.veicTracao
  const veicXml = veic
    ? `<veicTracao><cInt>${escapeXml(veic.cInt ?? '')}</cInt><placa>${veic.placa}</placa>${veic.RENAVAM ? `<RENAVAM>${veic.RENAVAM}</RENAVAM>` : ''}<tara>${veic.tara}</tara>${veic.capKG !== undefined ? `<capKG>${veic.capKG}</capKG>` : ''}${veic.capM3 !== undefined ? `<capM3>${veic.capM3}</capM3>` : ''}<tpProp>${veic.tpProp}</tpProp><tpVeic>${veic.tpVeic}</tpVeic><tpRod>${veic.tpRod}</tpRod><tpCar>${veic.tpCar}</tpCar><UF>${veic.UF}</UF></veicTracao>`
    : ''
  const mots =
    modal.motoristas
      ?.map((m) => `<moto><CPF>${m.CPF.replace(/\D/g, '')}</CPF><xNome>${escapeXml(m.xNome)}</xNome></moto>`)
      .join('') ?? ''
  const ciot = modal.CIOT ? `<CIOT><CIOT>${modal.CIOT}</CIOT></CIOT>` : ''
  const contr = modal.contratante
    ? `<contratante>${modal.contratante.CNPJ ? `<CNPJ>${modal.contratante.CNPJ.replace(/\D/g, '')}</CNPJ>` : `<CPF>${modal.contratante.CPF!.replace(/\D/g, '')}</CPF>`}<xNome>${escapeXml(modal.contratante.xNome)}</xNome></contratante>`
    : ''
  return `<rodo><RNTRC>${modal.rntrc}</RNTRC>${veicXml}${mots}${ciot}${contr}</rodo>`
}

// ─── Modal aéreo ──────────────────────────────────────────────────────────────

function buildModalAereo(modal: Extract<CteModalData, { modal: '02' }>): string {
  const manu = modal.natCarga.cInfManu.map((c) => `<cInfManu>${c}</cInfManu>`).join('')
  const dime = modal.natCarga.xDime ? `<xDime>${escapeXml(modal.natCarga.xDime)}</xDime>` : ''
  const peri =
    modal.peri
      ?.map(
        (p) =>
          `<peri><nONU>${p.nONU}</nONU><qTotProd>${p.qTotProd}</qTotProd><qVolTipo>${p.qVolTipo}</qVolTipo></peri>`,
      )
      .join('') ?? ''
  return `<aeri><nMinu>${modal.nMinu}</nMinu><nOCA>${modal.nOCA}</nOCA><dPrev>${modal.dPrev}</dPrev><natCarga>${dime}${manu}</natCarga><tarifa><CL>${modal.tarifa.CL}</CL>${modal.tarifa.cTar ? `<cTar>${modal.tarifa.cTar}</cTar>` : ''}<vTar>${modal.tarifa.vTar.toFixed(2)}</vTar></tarifa>${peri}</aeri>`
}

// ─── Modal aquaviário ─────────────────────────────────────────────────────────

function buildModalAquaviario(modal: Extract<CteModalData, { modal: '03' }>): string {
  const balsas =
    modal.balsa
      ?.map(
        (b) =>
          `<balsa><xBalsa>${b.xBalsa}</xBalsa>${b.nViag ? `<nViag>${b.nViag}</nViag>` : ''}<cEmbar>${b.cEmbar}</cEmbar><xEmbar>${b.xEmbar}</xEmbar></balsa>`,
      )
      .join('') ?? ''
  const conts =
    modal.detCont
      ?.map((c) => {
        const lacres = c.lacre?.map((l) => `<lacre><nLacre>${l.nLacre}</nLacre></lacre>`).join('') ?? ''
        const sucs =
          c.infSucatan?.map((s) => `<infSucatan><nSucatan>${s.nSucatan}</nSucatan></infSucatan>`).join('') ?? ''
        return `<detCont><nCont>${c.nCont}</nCont>${lacres}${sucs}</detCont>`
      })
      .join('') ?? ''
  return `<aquav><irin>${modal.irin}</irin><tpNav>${modal.tpNav}</tpNav>${balsas}${conts}</aquav>`
}

// ─── Modal ferroviário ────────────────────────────────────────────────────────

function buildModalFerroviario(modal: Extract<CteModalData, { modal: '04' }>): string {
  const ferr = modal.ferrEmi
    ? `<ferrEmi><CNPJ>${modal.ferrEmi.CNPJ.replace(/\D/g, '')}</CNPJ>${modal.ferrEmi.cInt ? `<cInt>${modal.ferrEmi.cInt}</cInt>` : ''}<IE>${modal.ferrEmi.IE}</IE><xNome>${escapeXml(modal.ferrEmi.xNome)}</xNome><fluxo>${modal.ferrEmi.fluxo}</fluxo></ferrEmi>`
    : ''
  const vagoes =
    modal.vagao
      ?.map(
        (v) => `<vagao><serie>${v.serie}</serie><nVag>${v.nVag}</nVag><nSeq>${v.nSeq}</nSeq><TU>${v.TU}</TU></vagao>`,
      )
      .join('') ?? ''
  return `<ferrov><tpTraf>${modal.tpTraf}</tpTraf>${ferr}${vagoes}</ferrov>`
}

function buildModal(modal: CteModalData): string {
  switch (modal.modal) {
    case '01':
      return buildModalRodoviario(modal)
    case '02':
      return buildModalAereo(modal)
    case '03':
      return buildModalAquaviario(modal)
    case '04':
      return buildModalFerroviario(modal)
    default:
      return ''
  }
}

// ─── Builder principal ────────────────────────────────────────────────────────

export type BuiltCteXml = {
  readonly xml: string
  readonly chaveAcesso: string
  readonly cCT: string
}

export function buildCteXml(config: CteConfig, data: CteData, now: Date = new Date()): BuiltCteXml {
  const cUF = UF_IBGE_CODES_CTE[config.uf] ?? '35'
  const tpAmb = config.environment === 'producao' ? '1' : '2'
  const chave = buildChaveCte({
    cUF,
    dhEmi: now,
    cnpj: config.cnpj,
    serie: config.serie,
    nCT: config.numeroCte,
    tpEmis: '1',
  })

  const cCT = chave.slice(35, 43)
  const cDV = chave.slice(43)

  const dhEmi = formatDhEmi(now)

  const tpServ = data.tipoServico
  // TSerie/TNF não aceitam zeros à esquerda — o zero-padding só vale dentro da chave de acesso
  const serie = String(parseInt(config.serie, 10))
  const nCT = String(config.numeroCte)

  // toma3 quando o tomador é rem/exped/receb/dest (sem dados de endereço extra)
  const toma = `<toma3><toma>${data.tomador}</toma></toma3>`

  // retira='0' significa que o recebedor retira no porto/aeroporto/filial — entrega no endereço é '1'
  const retira = data.retira ?? '1'
  const xDetRetira = data.xDetRetira ? `<xDetRetira>${data.xDetRetira}</xDetRetira>` : ''
  const indIEToma = data.indIEToma ?? '9'

  // Emitente
  const emit = `<emit><CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ><IE>${config.inscricaoEstadual || 'ISENTO'}</IE><xNome>${tpAmb === '2' ? 'CT-E EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : escapeXml(config.razaoSocial)}</xNome><enderEmit><xLgr>${escapeXml(config.logradouro)}</xLgr><nro>${escapeXml(config.numero)}</nro>${config.complemento ? `<xCpl>${escapeXml(config.complemento)}</xCpl>` : ''}<xBairro>${escapeXml(config.bairro)}</xBairro><cMun>${config.codigoMunicipio}</cMun><xMun>${escapeXml(config.municipio)}</xMun><CEP>${config.cep.replace(/\D/g, '')}</CEP><UF>${config.uf}</UF>${config.telefone ? `<fone>${config.telefone.replace(/\D/g, '')}</fone>` : ''}</enderEmit><CRT>${config.crt}</CRT></emit>`

  // Rem / Dest / expedidor / recebedor
  // Rejeições 646/647/648/649: em homologação a SEFAZ exige esta razão social exata nas partes
  const anonimizar = (p: CteParticipante): CteParticipante =>
    tpAmb === '2' ? { ...p, xNome: HOMOLOGACAO_XNOME_PARTICIPANTE } : p

  const rem = buildParticipante('rem', anonimizar(data.remetente))
  const dest = buildParticipante('dest', anonimizar(data.destinatario))
  const exped = data.expedidor ? buildParticipante('exped', anonimizar(data.expedidor)) : ''
  const receb = data.recebedor ? buildParticipante('receb', anonimizar(data.recebedor)) : ''

  // vPrest
  const comps = data.componentesValor
    .map((c) => `<Comp><xNome>${escapeXml(c.xNome)}</xNome><vComp>${c.vComp.toFixed(2)}</vComp></Comp>`)
    .join('')
  const vPrest = `<vPrest><vTPrest>${data.valorTotalPrestacao.toFixed(2)}</vTPrest><vRec>${data.valorTotalReceber.toFixed(2)}</vRec>${comps}</vPrest>`

  // imp
  const imp = `<imp>${buildIcms(data.icms, config.crt)}<vTotTrib>0.00</vTotTrib></imp>`

  // infCTeNorm — carga e documentos
  const qtds = data.carga.quantidades
    .map(
      // qCarga é TDec_1104 — o schema exige exatamente 4 casas decimais
      (q) => `<infQ><cUnid>${q.cUnid}</cUnid><tpMed>${q.tpMed}</tpMed><qCarga>${q.qCarga.toFixed(4)}</qCarga></infQ>`,
    )
    .join('')
  const vCargaAverb =
    data.carga.vCargaAverb !== undefined ? `<vCargaAverb>${data.carga.vCargaAverb.toFixed(2)}</vCargaAverb>` : ''
  const infCarga = `<infCarga><vCarga>${data.carga.vCarga.toFixed(2)}</vCarga><proPred>${escapeXml(data.carga.proPred)}</proPred>${data.carga.xOutCat ? `<xOutCat>${escapeXml(data.carga.xOutCat)}</xOutCat>` : ''}${qtds}${vCargaAverb}</infCarga>`
  const infDoc = `<infDoc>${buildDocumentos(data.documentos)}</infDoc>`
  // O schema CT-e 4.00 exige o atributo versaoModal em infModal — versao é rejeitado com cStat 215
  const infModal = `<infModal versaoModal="4.00">${buildModal(data.modal)}</infModal>`
  const infCTeNorm = `<infCTeNorm>${infCarga}${infDoc}${infModal}</infCTeNorm>`

  const obsGer = data.informacoesAdicionais
    ? `<compl><xObs>${escapeXml(data.informacoesAdicionais)}</xObs></compl>`
    : ''
  const infAdic = data.observacoes ? `<infAdic><infCpl>${escapeXml(data.observacoes)}</infCpl></infAdic>` : ''

  const infCteId = `CTe${chave}`
  // Rejeição 850: o CT-e 4.00 exige o QR Code de consulta em infCTeSupl, entre infCte e a assinatura
  const qrCodCTe = `${getCteQrCodeUrl(config.uf, tpAmb === '1' ? 'producao' : 'homologacao')}?chCTe=${chave}&amp;tpAmb=${tpAmb}`
  const infCTeSupl = `<infCTeSupl><qrCodCTe>${qrCodCTe}</qrCodCTe></infCTeSupl>`
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CTe xmlns="${CTE_NS}"><infCte versao="4.00" Id="${infCteId}"><ide><cUF>${cUF}</cUF><cCT>${cCT}</cCT><CFOP>${data.cfop}</CFOP><natOp>${escapeXml(data.naturezaOperacao)}</natOp><mod>57</mod><serie>${serie}</serie><nCT>${nCT}</nCT><dhEmi>${dhEmi}</dhEmi><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${cDV}</cDV><tpAmb>${tpAmb}</tpAmb><tpCTe>0</tpCTe><procEmi>0</procEmi><verProc>fiscal-provider@1.0</verProc><cMunEnv>${config.codigoMunicipio}</cMunEnv><xMunEnv>${escapeXml(config.municipio)}</xMunEnv><UFEnv>${config.uf}</UFEnv><modal>${data.modal.modal}</modal><tpServ>${tpServ}</tpServ><cMunIni>${data.municipioOrigem.codigo}</cMunIni><xMunIni>${escapeXml(data.municipioOrigem.nome)}</xMunIni><UFIni>${data.municipioOrigem.uf}</UFIni><cMunFim>${data.municipioDestino.codigo}</cMunFim><xMunFim>${escapeXml(data.municipioDestino.nome)}</xMunFim><UFFim>${data.municipioDestino.uf}</UFFim><retira>${retira}</retira>${xDetRetira}<indIEToma>${indIEToma}</indIEToma>${toma}</ide>${obsGer}${emit}${rem}${exped}${receb}${dest}${vPrest}${imp}${infCTeNorm}${infAdic}</infCte>${infCTeSupl}</CTe>`

  return { xml, chaveAcesso: chave, cCT }
}
