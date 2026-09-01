import { isValidCnpj, isValidCpf, isValidPlate, isValidRenavam, isValidState } from './checkDigit.service'
import { normalizeLabel, readValueBelowLabel } from './labelGeometry.service'
import type { PdfPageText } from './pdfTextLayer.service'

/**
 * Spec 071: o mapa do CRLV sobe para cá porque **duas** apps o leem — o painel do operador, no
 * cadastro do veículo, e a landing, no navegador de quem se candidata a agregado. Enquanto só o
 * painel lia, ele morava lá, pelo mesmo critério que manteve o CCMEI aqui desde a 066.
 *
 * O que o pacote devolve é **o que está impresso**, canonicalizado — `bodyType: 'FURGAO'`,
 * `fuel: 'ALCOOL/GASOLINA'`. A tradução para o catálogo (`MdfeBodyType`, `FuelProduct`,
 * `VehicleColor`) é de quem tem catálogo, e as duas apps têm catálogos diferentes: a ficha da
 * landing não tem carroceria nem combustível. Subir a tradução junto poria o catálogo de uma app
 * dentro de uma biblioteca que quatro consomem. ADR-0054 do `transportada`.
 *
 * A divisão decide quem quebra quando: o Detran mudar o layout quebra aqui; o nosso catálogo mudar
 * quebra no app.
 */
export type CrlvRemarkReason = 'checkDigitFailed' | 'notInformed' | 'notReadable'

export type CrlvRemark = Readonly<{
  field: string
  reason: CrlvRemarkReason
}>

/**
 * Os campos do documento, não os da ficha. `bodyType`, `color` e `fuel` saem normalizados
 * (`normalizeLabel`) porque é assim que a tabela de tradução do app os indexa — devolver o texto
 * cru obrigaria cada consumidor a repetir a normalização, que é o começo da divergência calada.
 */
export type CrlvValues = Readonly<{
  axleCount: string
  bodyType: string
  brand: string
  color: string
  fuel: string
  model: string
  modelYear: string
  municipality: string
  ownerName: string
  ownerTaxId: string
  plate: string
  renavam: string
  state: string
}>

export type CrlvReading = Readonly<{
  remarks: readonly CrlvRemark[]
  values: Partial<CrlvValues>
}>

/** Na ordem em que o documento imprime — é assim que se confere o mapa contra uma amostra. */
const LABEL = {
  axleCount: 'EIXOS',
  bodyType: 'CARROCERIA',
  color: 'COR PREDOMINANTE',
  fuel: 'COMBUSTIVEL',
  modelYear: 'ANO MODELO',
  municipalityState: 'MUNICIPIO / UF',
  ownerName: 'NOME',
  ownerTaxId: 'CPF / CNPJ',
  plate: 'PLACA',
  renavam: 'CODIGO RENAVAM',
  vehicleModel: 'MARCA / MODELO / VERSAO',
} as const

/** O Detran imprime `*` onde não informou. Asterisco é campo vazio, nunca `0`. */
const NOT_INFORMED_MARK = '*'

const MODEL_YEAR_LENGTH = 4

type MutableValues = { -readonly [Key in keyof CrlvValues]?: CrlvValues[Key] }

type Collector = Readonly<{
  remark: (field: string, reason: CrlvRemarkReason) => void
  values: MutableValues
}>

function readLabel(page: PdfPageText, label: string): string | undefined {
  const value = readValueBelowLabel(page.fragments, label)
  if (value === undefined) return undefined

  const trimmed = value.trim()

  return trimmed.length === 0 || trimmed === NOT_INFORMED_MARK ? undefined : trimmed
}

/** `MARCA / MODELO / VERSÃO` parte no **primeiro** `/`: a versão faz parte do modelo, a marca não. */
function splitBrandAndModel(printed: string): Readonly<{ brand: string; model: string }> {
  const separator = printed.indexOf('/')
  if (separator < 0) return { brand: printed.trim(), model: '' }

  return { brand: printed.slice(0, separator).trim(), model: printed.slice(separator + 1).trim() }
}

/**
 * `SÃO PAULO / SP` parte na **última** barra, ao contrário de marca e modelo: a UF é o sufixo, e
 * nome de município com barra no meio não pode roubar a divisão.
 */
function splitMunicipalityAndState(printed: string): Readonly<{ municipality: string; state: string }> {
  const separator = printed.lastIndexOf('/')
  if (separator < 0) return { municipality: printed.trim(), state: '' }

  return {
    municipality: printed.slice(0, separator).trim(),
    state: normalizeLabel(printed.slice(separator + 1)),
  }
}

function collectIdentity(page: PdfPageText, collector: Collector): void {
  const plate = readLabel(page, LABEL.plate)
  if (plate !== undefined) {
    const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/gu, '')
    if (isValidPlate(normalized)) collector.values.plate = normalized
    else collector.remark('plate', 'checkDigitFailed')
  }

  const renavam = readLabel(page, LABEL.renavam)
  if (renavam !== undefined) {
    const digits = renavam.replace(/\D/gu, '')
    if (isValidRenavam(digits)) collector.values.renavam = digits
    else collector.remark('renavam', 'checkDigitFailed')
  }

  const printedOrigin = readLabel(page, LABEL.municipalityState)
  if (printedOrigin !== undefined) {
    const { municipality, state } = splitMunicipalityAndState(printedOrigin)
    if (municipality.length > 0) collector.values.municipality = municipality
    if (isValidState(state)) collector.values.state = state
    else collector.remark('state', 'notReadable')
  }
}

function collectModel(page: PdfPageText, collector: Collector): void {
  const printedModel = readLabel(page, LABEL.vehicleModel)
  if (printedModel !== undefined) {
    const { brand, model } = splitBrandAndModel(printedModel)
    if (brand.length > 0) collector.values.brand = brand
    if (model.length > 0) collector.values.model = model
  }

  const modelYear = readLabel(page, LABEL.modelYear)?.replace(/\D/gu, '')
  if (modelYear !== undefined && modelYear.length === MODEL_YEAR_LENGTH) {
    collector.values.modelYear = modelYear
  }

  const color = readLabel(page, LABEL.color)
  if (color !== undefined) collector.values.color = normalizeLabel(color)
}

function collectOperation(page: PdfPageText, collector: Collector): void {
  const axleCount = readLabel(page, LABEL.axleCount)?.replace(/\D/gu, '')
  if (axleCount === undefined || axleCount.length === 0) collector.remark('axleCount', 'notInformed')
  else collector.values.axleCount = axleCount

  const bodyType = readLabel(page, LABEL.bodyType)
  if (bodyType !== undefined) collector.values.bodyType = normalizeLabel(bodyType)

  const fuel = readLabel(page, LABEL.fuel)
  if (fuel !== undefined) collector.values.fuel = normalizeLabel(fuel)
}

/**
 * O proprietário é dado de pessoa física impresso no documento do veículo, e é ele que faz o CRLV
 * atravessar bloco do formulário: nome e documento não são campos de veículo.
 */
function collectOwner(page: PdfPageText, collector: Collector): void {
  const name = readLabel(page, LABEL.ownerName)
  if (name !== undefined) collector.values.ownerName = name

  const taxId = readLabel(page, LABEL.ownerTaxId)
  if (taxId === undefined) return

  const cleaned = taxId.replace(/[^0-9A-Za-z]/gu, '').toUpperCase()
  if (isValidCpf(cleaned) || isValidCnpj(cleaned)) collector.values.ownerTaxId = cleaned
  else collector.remark('ownerTaxId', 'checkDigitFailed')
}

export function readCrlv(page: PdfPageText): CrlvReading {
  const remarks: CrlvRemark[] = []
  const collector: Collector = {
    remark: (field, reason) => remarks.push({ field, reason }),
    values: {},
  }

  collectIdentity(page, collector)
  collectModel(page, collector)
  collectOperation(page, collector)
  collectOwner(page, collector)

  return { remarks, values: collector.values }
}
