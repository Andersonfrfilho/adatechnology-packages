import { randomInt } from 'crypto'
import type { CteConfig, CteData, CteParticipante, CteIcms, CteModalData, CteDocumento } from '../types'
import { UF_IBGE_CODES_CTE } from './CteConstants'
import { formatDhEmi, toBrasiliaWallClock } from './SefazDateTime'

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
  const email = p.email ? `<email>${p.email}</email>` : ''
  const cep = p.cep ? `<CEP>${p.cep.replace(/\D/g, '')}</CEP>` : ''
  const cpl = p.xCpl ? `<xCpl>${p.xCpl}</xCpl>` : ''
  return `<${tag}><xLgr>${p.xLgr}</xLgr><nro>${p.nro}</nro>${cpl}<xBairro>${p.xBairro}</xBairro><cMun>${p.cMun}</cMun><xMun>${p.xMun}</xMun>${cep}<UF>${p.uf}</UF>${fone}${email}</${tag}>`
}

// ─── Participante ─────────────────────────────────────────────────────────────

function buildParticipante(tag: string, p: CteParticipante): string {
  const doc = p.cnpj ? `<CNPJ>${p.cnpj.replace(/\D/g, '')}</CNPJ>` : `<CPF>${p.cpf!.replace(/\D/g, '')}</CPF>`
  const xFant = p.xFant ? `<xFant>${p.xFant}</xFant>` : ''
  return `<${tag}>${doc}<IE>${p.ie ?? 'ISENTO'}</IE><xNome>${p.xNome}</xNome>${xFant}${buildEnderecoTag(`ender${tag.charAt(0).toUpperCase()}${tag.slice(1)}`, p)}</${tag}>`
}

// ─── ICMS ─────────────────────────────────────────────────────────────────────

function buildIcms(icms: CteIcms): string {
  const fmt = (n: number) => n.toFixed(2)
  switch (icms.cst) {
    case '00':
      return `<ICMS><ICMS00><CST>00</CST><vBC>${fmt(icms.vBC)}</vBC><pICMS>${fmt(icms.pICMS)}</pICMS><vICMS>${fmt(icms.vICMS)}</vICMS></ICMS00></ICMS>`
    case '20':
      return `<ICMS><ICMS20><CST>20</CST><pRedBC>${fmt(icms.pRedBC)}</pRedBC><vBC>${fmt(icms.vBC)}</vBC><pICMS>${fmt(icms.pICMS)}</pICMS><vICMS>${fmt(icms.vICMS)}</vICMS></ICMS20></ICMS>`
    case '40':
    case '41':
    case '51':
      return `<ICMS><ICMS40><CST>${icms.cst}</CST></ICMS40></ICMS>`
    case '60':
      return `<ICMS><ICMS60><CST>60</CST><vBCSTRet>${fmt(icms.vBCSTRet)}</vBCSTRet><pICMSSTRet>${fmt(icms.pICMSSTRet)}</pICMSSTRet><vICMSSTRet>${fmt(icms.vICMSSTRet)}</vICMSSTRet></ICMS60></ICMS>`
    case '90':
      return `<ICMS><ICMS90><CST>90</CST>${icms.vBC !== undefined ? `<vBC>${fmt(icms.vBC)}</vBC><pICMS>${fmt(icms.pICMS!)}</pICMS><vICMS>${fmt(icms.vICMS!)}</vICMS>` : ''}</ICMS90></ICMS>`
    default:
      return `<ICMS><ICMS40><CST>41</CST></ICMS40></ICMS>`
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
                `<peri><nONU>${p.nONU}</nONU><xNomeAE>${p.xNomeAE}</xNomeAE><xClaRisco>${p.xClaRisco}</xClaRisco><grEmb>${p.grEmb}</grEmb><qTotProd>${p.qTotProd}</qTotProd><qVolTipo>${p.qVolTipo}</qVolTipo></peri>`,
            )
            .join('') ?? ''
        return `<infNFe><chave>${doc.chave}</chave>${doc.pin ? `<PIN>${doc.pin}</PIN>` : ''}${peri}</infNFe>`
      }
      const num = doc.numero ? `<nDoc>${doc.numero}</nDoc>` : ''
      const val = doc.valor !== undefined ? `<vDoc>${doc.valor.toFixed(2)}</vDoc>` : ''
      const dat = doc.data ? `<dEmis>${doc.data}</dEmis>` : ''
      const desc = doc.descOutros ? `<descOutros>${doc.descOutros}</descOutros>` : ''
      return `<infOutros><tpDoc>${doc.tpDoc}</tpDoc>${desc}${num}${dat}${val}</infOutros>`
    })
    .join('')
}

// ─── Modal rodoviário ─────────────────────────────────────────────────────────

function buildModalRodoviario(modal: Extract<CteModalData, { modal: '01' }>): string {
  const veic = modal.veicTracao
  const veicXml = veic
    ? `<veicTracao><cInt>${veic.cInt ?? ''}</cInt><placa>${veic.placa}</placa>${veic.RENAVAM ? `<RENAVAM>${veic.RENAVAM}</RENAVAM>` : ''}<tara>${veic.tara}</tara>${veic.capKG !== undefined ? `<capKG>${veic.capKG}</capKG>` : ''}${veic.capM3 !== undefined ? `<capM3>${veic.capM3}</capM3>` : ''}<tpProp>${veic.tpProp}</tpProp><tpVeic>${veic.tpVeic}</tpVeic><tpRod>${veic.tpRod}</tpRod><tpCar>${veic.tpCar}</tpCar><UF>${veic.UF}</UF></veicTracao>`
    : ''
  const mots =
    modal.motoristas
      ?.map((m) => `<moto><CPF>${m.CPF.replace(/\D/g, '')}</CPF><xNome>${m.xNome}</xNome></moto>`)
      .join('') ?? ''
  const ciot = modal.CIOT ? `<CIOT><CIOT>${modal.CIOT}</CIOT></CIOT>` : ''
  const contr = modal.contratante
    ? `<contratante>${modal.contratante.CNPJ ? `<CNPJ>${modal.contratante.CNPJ.replace(/\D/g, '')}</CNPJ>` : `<CPF>${modal.contratante.CPF!.replace(/\D/g, '')}</CPF>`}<xNome>${modal.contratante.xNome}</xNome></contratante>`
    : ''
  return `<rodo><RNTRC>${modal.rntrc}</RNTRC>${veicXml}${mots}${ciot}${contr}</rodo>`
}

// ─── Modal aéreo ──────────────────────────────────────────────────────────────

function buildModalAereo(modal: Extract<CteModalData, { modal: '02' }>): string {
  const manu = modal.natCarga.cInfManu.map((c) => `<cInfManu>${c}</cInfManu>`).join('')
  const dime = modal.natCarga.xDime ? `<xDime>${modal.natCarga.xDime}</xDime>` : ''
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
    ? `<ferrEmi><CNPJ>${modal.ferrEmi.CNPJ.replace(/\D/g, '')}</CNPJ>${modal.ferrEmi.cInt ? `<cInt>${modal.ferrEmi.cInt}</cInt>` : ''}<IE>${modal.ferrEmi.IE}</IE><xNome>${modal.ferrEmi.xNome}</xNome><fluxo>${modal.ferrEmi.fluxo}</fluxo></ferrEmi>`
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
  const serie = String(parseInt(config.serie, 10)).padStart(3, '0')
  const nCT = String(config.numeroCte).padStart(9, '0')

  // toma3 quando o tomador é rem/exped/receb/dest (sem dados de endereço extra)
  const toma = `<toma3><toma>${data.tomador}</toma></toma3>`

  // Emitente
  const emit = `<emit><CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ><IE>${config.inscricaoEstadual || 'ISENTO'}</IE><xNome>${tpAmb === '2' ? 'CT-E EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : config.razaoSocial}</xNome><enderEmit><xLgr>${config.logradouro}</xLgr><nro>${config.numero}</nro>${config.complemento ? `<xCpl>${config.complemento}</xCpl>` : ''}<xBairro>${config.bairro}</xBairro><cMun>${config.codigoMunicipio}</cMun><xMun>${config.municipio}</xMun><CEP>${config.cep.replace(/\D/g, '')}</CEP><UF>${config.uf}</UF>${config.telefone ? `<fone>${config.telefone.replace(/\D/g, '')}</fone>` : ''}</enderEmit><CRT>${config.crt}</CRT></emit>`

  // Rem / Dest / expedidor / recebedor
  const rem = buildParticipante('rem', data.remetente)
  const dest = buildParticipante('dest', data.destinatario)
  const exped = data.expedidor ? buildParticipante('exped', data.expedidor) : ''
  const receb = data.recebedor ? buildParticipante('receb', data.recebedor) : ''

  // vPrest
  const comps = data.componentesValor
    .map((c) => `<Comp><xNome>${c.xNome}</xNome><vComp>${c.vComp.toFixed(2)}</vComp></Comp>`)
    .join('')
  const vPrest = `<vPrest><vTPrest>${data.valorTotalPrestacao.toFixed(2)}</vTPrest><vRec>${data.valorTotalReceber.toFixed(2)}</vRec>${comps}</vPrest>`

  // imp
  const imp = `<imp>${buildIcms(data.icms)}<vTotTrib>0.00</vTotTrib></imp>`

  // infCTeNorm — carga e documentos
  const qtds = data.carga.quantidades
    .map(
      (q) => `<infQ><cUnid>${q.cUnid}</cUnid><tpMed>${q.tpMed}</tpMed><qCarga>${q.qCarga.toFixed(3)}</qCarga></infQ>`,
    )
    .join('')
  const infCarga = `<infCarga><vCarga>${data.carga.vCarga.toFixed(2)}</vCarga><proPred>${data.carga.proPred}</proPred>${data.carga.xOutCat ? `<xOutCat>${data.carga.xOutCat}</xOutCat>` : ''}${qtds}</infCarga>`
  const infDoc = `<infDoc>${buildDocumentos(data.documentos)}</infDoc>`
  const infModal = `<infModal versao="4.00">${buildModal(data.modal)}</infModal>`
  const infCTeNorm = `<infCTeNorm>${infCarga}${infDoc}${infModal}</infCTeNorm>`

  const obsGer = data.informacoesAdicionais ? `<compl><xObs>${data.informacoesAdicionais}</xObs></compl>` : ''
  const infAdic = data.observacoes ? `<infAdic><infCpl>${data.observacoes}</infCpl></infAdic>` : ''

  const infCteId = `CTe${chave}`
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CTe versao="4.00" xmlns="${CTE_NS}"><infCTe Id="${infCteId}"><ide><cUF>${cUF}</cUF><cCT>${cCT}</cCT><CFOP>${data.cfop}</CFOP><natOp>${data.naturezaOperacao}</natOp><mod>57</mod><serie>${serie}</serie><nCT>${nCT}</nCT><dhEmi>${dhEmi}</dhEmi><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${cDV}</cDV><tpAmb>${tpAmb}</tpAmb><tpCTe>0</tpCTe><procEmi>0</procEmi><verProc>fiscal-provider@1.0</verProc><cMunEnv>${config.codigoMunicipio}</cMunEnv><xMunEnv>${config.municipio}</xMunEnv><UFEnv>${config.uf}</UFEnv><modal>${data.modal.modal}</modal><tpServ>${tpServ}</tpServ><cMunIni>${data.municipioOrigem.codigo}</cMunIni><xMunIni>${data.municipioOrigem.nome}</xMunIni><UFIni>${data.municipioOrigem.uf}</UFIni><cMunFim>${data.municipioDestino.codigo}</cMunFim><xMunFim>${data.municipioDestino.nome}</xMunFim><UFFim>${data.municipioDestino.uf}</UFFim><retira>0</retira><indIEToma>9</indIEToma>${toma}</ide>${obsGer}${emit}${rem}${exped}${receb}${dest}${vPrest}${imp}${infCTeNorm}${infAdic}</infCTe></CTe>`

  return { xml, chaveAcesso: chave, cCT }
}
