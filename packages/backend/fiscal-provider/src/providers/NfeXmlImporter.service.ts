/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

import { XMLParser } from 'fast-xml-parser'

import { NFE_XML_IMPORT_ERROR_CODE, NfeXmlImportError, type NfeXmlImportErrorCode } from '../errors/NfeXmlImport.error'
import { isChaveDvValid } from '../sefaz/SefazChave'
import type {
  DfeItem,
  ImportedAuthorizedNfeXml,
  ImportedNfeEventXml,
  ImportedNfeXml,
  ImportedUnsignedNfeXml,
  NfeXmlAddress,
  NfeXmlDocument,
  NfeXmlEvent,
  NfeXmlParty,
  NfeXmlProduct,
  NfeXmlProtocol,
  NfeXmlTotals,
  NfeXmlVolume,
} from '../types'

const MAX_NFE_XML_BYTES = 5 * 1024 * 1024
const ACCESS_KEY_PATTERN = /^\d{44}$/
const CNPJ_PATTERN = /^\d{14}$/
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/
const FORBIDDEN_XML_DECLARATION_PATTERN = /<!\s*(?:DOCTYPE|ENTITY)\b/i

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '',
  parseTagValue: false,
})

type XmlRecord = Record<string, unknown>

type BuildDocumentParams = {
  readonly infNfe: XmlRecord
  readonly protocol?: NfeXmlProtocol
  readonly status: NfeXmlDocument['status']
}

type CreateDfeSummaryParams = {
  readonly document: NfeXmlDocument
  readonly situation?: string
  readonly xml: string
}

type RecordKeyParams = {
  readonly record: XmlRecord | undefined
  readonly key: string
}

type RecordKeysParams = {
  readonly record: XmlRecord
  readonly keys: readonly string[]
}

type RecordsKeyParams = {
  readonly records: readonly (XmlRecord | undefined)[]
  readonly key: string
}

type ParsePartyParams = {
  readonly value: unknown
  readonly addressKey?: string
}

type ThrowImportErrorParams = {
  readonly code: NfeXmlImportErrorCode
  readonly message: string
}

export function importarNfeXml(xml: string): ImportedNfeXml {
  assertSafeXmlInput(xml)
  const parsed = parseXml(xml)

  const processed = optionalRecord(parsed['nfeProc']) ?? optionalRecord(parsed['procNFe'])
  if (processed) return importAuthorizedNfe({ processed, xml })

  const bareNfe = optionalRecord(parsed['NFe'])
  if (bareNfe) return importUnsignedNfe({ bareNfe, xml })

  const processedEvent = optionalRecord(parsed['procEventoNFe']) ?? optionalRecord(parsed['retEnvEvento'])
  if (processedEvent) return importNfeEvent({ processedEvent, xml })

  throwImportError({
    code: NFE_XML_IMPORT_ERROR_CODE.unsupportedDocument,
    message: 'Unsupported fiscal XML document',
  })
}

function assertSafeXmlInput(xml: string): void {
  if (Buffer.byteLength(xml, 'utf8') > MAX_NFE_XML_BYTES) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.tooLarge,
      message: 'NF-e XML exceeds the import limit',
    })
  }
  if (FORBIDDEN_XML_DECLARATION_PATTERN.test(xml)) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.forbiddenDeclaration,
      message: 'NF-e XML contains a forbidden declaration',
    })
  }
}

function parseXml(xml: string): XmlRecord {
  try {
    const parsed: unknown = XML_PARSER.parse(xml)
    return requireRecord(parsed)
  } catch (error: unknown) {
    if (error instanceof NfeXmlImportError) throw error
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'Invalid NF-e XML structure',
    })
  }
}

function importAuthorizedNfe(params: {
  readonly processed: XmlRecord
  readonly xml: string
}): ImportedAuthorizedNfeXml {
  const nfe = optionalRecord(params.processed['NFe']) ?? params.processed
  const infNfe = requireRecord(nfe['infNFe'])
  const protocol = parseProtocol(params.processed)
  const document = buildDocument({ infNfe, protocol, status: 'authorized' })

  if (protocolAccessKey(params.processed) !== document.accessKey) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.accessKeyMismatch,
      message: 'NF-e access key differs from its authorization protocol',
    })
  }

  return {
    ...createDfeSummary({ document, situation: '1', xml: params.xml }),
    kind: 'authorized-nfe',
    document: { ...document, protocol, status: 'authorized' },
  }
}

function importUnsignedNfe(params: { readonly bareNfe: XmlRecord; readonly xml: string }): ImportedUnsignedNfeXml {
  const infNfe = requireRecord(params.bareNfe['infNFe'])
  const document = buildDocument({ infNfe, status: 'unsigned' })

  return {
    ...createDfeSummary({ document, xml: params.xml }),
    kind: 'unsigned-nfe',
    document: { ...document, protocol: undefined, status: 'unsigned' },
  }
}

function importNfeEvent(params: { readonly processedEvent: XmlRecord; readonly xml: string }): ImportedNfeEventXml {
  const event = parseEvent(params.processedEvent)

  return {
    nsu: '',
    schema: 'xml-import',
    xmlComprimido: '',
    xmlDecoded: params.xml,
    chaveNfe: event.accessKey,
    mod: '55',
    emitenteCnpj: undefined,
    emitenteNome: undefined,
    valorTotal: undefined,
    dataEmissao: event.occurredAt,
    situacao: undefined,
    tipoEvento: event.type,
    descricaoEvento: event.description,
    dataEvento: event.occurredAt,
    kind: 'nfe-event',
    event,
  }
}

function buildDocument({ infNfe, protocol, status }: BuildDocumentParams): NfeXmlDocument {
  const ide = requireRecord(infNfe['ide'])
  const model = requireString({ key: 'mod', record: ide })
  if (model !== '55') {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.unsupportedDocument,
      message: 'Only NF-e model 55 XML is supported',
    })
  }

  const issuer = parseRequiredParty({ addressKey: 'enderEmit', value: infNfe['emit'] })
  const recipient = parseParty({ addressKey: 'enderDest', value: infNfe['dest'] })
  const transportation = optionalRecord(infNfe['transp'])
  const carrier = parseCarrier(transportation?.['transporta'])
  const pickup = parseParty({ value: infNfe['retirada'] })
  const delivery = parseParty({ value: infNfe['entrega'] })

  return {
    accessKey: parseAccessKey(requireString({ key: 'Id', record: infNfe }).replace(/^NFe/, '')),
    model,
    number: requireString({ key: 'nNF', record: ide }),
    series: requireString({ key: 'serie', record: ide }),
    issuedAt: requireFirstString({ keys: ['dhEmi', 'dEmi'], record: ide }),
    operationNature: requireString({ key: 'natOp', record: ide }),
    operationType: requireString({ key: 'tpNF', record: ide }),
    status,
    totals: parseTotals(infNfe),
    issuer,
    recipient,
    carrier,
    pickup,
    delivery,
    products: parseProducts(infNfe),
    volumes: parseVolumes(transportation),
    protocol,
    additionalInformation: optionalString({
      key: 'infCpl',
      record: optionalRecord(infNfe['infAdic']),
    }),
    relatedCnpjs: collectRelatedCnpjs([issuer, recipient, carrier, pickup, delivery]),
  }
}

function parseProtocol(processed: XmlRecord): NfeXmlProtocol {
  const protocol = requireRecord(processed['protNFe'])
  const info = requireRecord(protocol['infProt'])
  const statusCode = requireString({ key: 'cStat', record: info })
  if (statusCode !== '100') {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'NF-e authorization protocol is not authorized',
    })
  }

  return {
    number: requireString({ key: 'nProt', record: info }),
    authorizedAt: requireString({ key: 'dhRecbto', record: info }),
    statusCode,
    reason: requireString({ key: 'xMotivo', record: info }),
  }
}

function protocolAccessKey(processed: XmlRecord): string {
  const protocol = requireRecord(processed['protNFe'])
  const info = requireRecord(protocol['infProt'])
  return parseAccessKey(requireString({ key: 'chNFe', record: info }))
}

function parseTotals(infNfe: XmlRecord): NfeXmlTotals {
  const total = requireRecord(infNfe['total'])
  const icmsTotal = requireRecord(total['ICMSTot'])

  return {
    invoice: requireDecimal({ key: 'vNF', record: icmsTotal }),
    products: requireDecimal({ key: 'vProd', record: icmsTotal }),
    freight: optionalDecimal({ key: 'vFrete', record: icmsTotal }),
    insurance: optionalDecimal({ key: 'vSeg', record: icmsTotal }),
    discount: optionalDecimal({ key: 'vDesc', record: icmsTotal }),
    otherExpenses: optionalDecimal({ key: 'vOutro', record: icmsTotal }),
  }
}

function parseProducts(infNfe: XmlRecord): readonly NfeXmlProduct[] {
  const items = toArray(infNfe['det'])
  if (items.length === 0) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'NF-e has no product items',
    })
  }

  return items.map((item) => {
    const detail = requireRecord(item)
    const product = requireRecord(detail['prod'])
    return {
      lineNumber: requireString({ key: 'nItem', record: detail }),
      code: requireString({ key: 'cProd', record: product }),
      description: requireString({ key: 'xProd', record: product }),
      ncm: requireString({ key: 'NCM', record: product }),
      cfop: requireString({ key: 'CFOP', record: product }),
      commercialUnit: requireString({ key: 'uCom', record: product }),
      commercialQuantity: requireDecimal({ key: 'qCom', record: product }),
      unitValue: requireDecimal({ key: 'vUnCom', record: product }),
      totalValue: requireDecimal({ key: 'vProd', record: product }),
    }
  })
}

function parseVolumes(transportation: XmlRecord | undefined): readonly NfeXmlVolume[] {
  if (!transportation) return []

  return toArray(transportation['vol']).map((value) => {
    const volume = requireRecord(value)
    return {
      quantity: optionalDecimal({ key: 'qVol', record: volume }),
      species: optionalString({ key: 'esp', record: volume }),
      brand: optionalString({ key: 'marca', record: volume }),
      numbering: optionalString({ key: 'nVol', record: volume }),
      netWeight: optionalDecimal({ key: 'pesoL', record: volume }),
      grossWeight: optionalDecimal({ key: 'pesoB', record: volume }),
    }
  })
}

function parseRequiredParty(params: ParsePartyParams): NfeXmlParty {
  const party = parseParty(params)
  if (!party?.taxId || !party.name) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'NF-e issuer is incomplete',
    })
  }
  return party
}

function parseParty({ addressKey, value }: ParsePartyParams): NfeXmlParty | undefined {
  const source = optionalRecord(value)
  if (!source) return undefined

  const addressSource = addressKey ? optionalRecord(source[addressKey]) : source
  const party: NfeXmlParty = {
    taxId: optionalFirstString({ keys: ['CNPJ', 'CPF'], record: source }),
    name: optionalString({ key: 'xNome', record: source }),
    tradeName: optionalString({ key: 'xFant', record: source }),
    stateRegistration: optionalString({ key: 'IE', record: source }),
    address: parseAddress(addressSource),
  }

  return hasDefinedValue(party) ? party : undefined
}

function parseCarrier(value: unknown): NfeXmlParty | undefined {
  const source = optionalRecord(value)
  if (!source) return undefined

  const party: NfeXmlParty = {
    taxId: optionalFirstString({ keys: ['CNPJ', 'CPF'], record: source }),
    name: optionalString({ key: 'xNome', record: source }),
    stateRegistration: optionalString({ key: 'IE', record: source }),
    address: parseCarrierAddress(source),
  }
  return hasDefinedValue(party) ? party : undefined
}

function parseAddress(source: XmlRecord | undefined): NfeXmlAddress | undefined {
  if (!source) return undefined

  const address: NfeXmlAddress = {
    street: optionalString({ key: 'xLgr', record: source }),
    number: optionalString({ key: 'nro', record: source }),
    complement: optionalString({ key: 'xCpl', record: source }),
    district: optionalString({ key: 'xBairro', record: source }),
    cityCode: optionalString({ key: 'cMun', record: source }),
    city: optionalString({ key: 'xMun', record: source }),
    state: optionalString({ key: 'UF', record: source }),
    postalCode: optionalString({ key: 'CEP', record: source }),
    countryCode: optionalString({ key: 'cPais', record: source }),
    country: optionalString({ key: 'xPais', record: source }),
    phone: optionalString({ key: 'fone', record: source }),
  }
  return hasDefinedValue(address) ? address : undefined
}

function parseCarrierAddress(source: XmlRecord): NfeXmlAddress | undefined {
  const address: NfeXmlAddress = {
    street: optionalString({ key: 'xEnder', record: source }),
    city: optionalString({ key: 'xMun', record: source }),
    state: optionalString({ key: 'UF', record: source }),
  }
  return hasDefinedValue(address) ? address : undefined
}

function collectRelatedCnpjs(parties: readonly (NfeXmlParty | undefined)[]): readonly string[] {
  return [
    ...new Set(
      parties
        .map((party) => party?.taxId)
        .filter((taxId): taxId is string => taxId !== undefined && CNPJ_PATTERN.test(taxId)),
    ),
  ]
}

function assertMatchingEventIdentity(params: { readonly eventInfo: XmlRecord; readonly returnInfo: XmlRecord }): void {
  const identityKeys = ['chNFe', 'tpEvento', 'nSeqEvento'] as const
  for (const key of identityKeys) {
    if (requireString({ key, record: params.eventInfo }) !== requireString({ key, record: params.returnInfo })) {
      throwImportError({
        code: NFE_XML_IMPORT_ERROR_CODE.eventMismatch,
        message: 'NF-e event response identity differs from its request',
      })
    }
  }
}

function parseEvent(processed: XmlRecord): NfeXmlEvent {
  const eventContainer = optionalRecord(processed['evento']) ?? processed
  const eventInfo = optionalRecord(eventContainer['infEvento']) ?? optionalRecord(processed['infEvento'])
  const returnContainer = optionalRecord(processed['retEvento'])
  const returnInfo = optionalRecord(returnContainer?.['infEvento']) ?? optionalRecord(processed['retInfEvento'])
  const source = eventInfo ?? returnInfo
  if (!source) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'NF-e event is incomplete',
    })
  }
  if (eventInfo && returnInfo) {
    assertMatchingEventIdentity({ eventInfo, returnInfo })
  }

  const type = requireFirstString({ keys: ['tpEvento'], record: source })
  const detail = optionalRecord(source['detEvento'])
  return {
    accessKey: parseAccessKey(
      requireFirstStringFromRecords({
        key: 'chNFe',
        records: [eventInfo, returnInfo],
      }),
    ),
    type,
    sequence: requireFirstStringFromRecords({
      key: 'nSeqEvento',
      records: [eventInfo, returnInfo],
    }),
    occurredAt: requireFirstStringFromRecords({
      key: eventInfo ? 'dhEvento' : 'dhRegEvento',
      records: [eventInfo, returnInfo],
    }),
    description: optionalString({ key: 'descEvento', record: detail }) ?? resolveEventDescription(type),
    protocol: optionalString({ key: 'nProt', record: returnInfo }) ?? optionalString({ key: 'nProt', record: detail }),
    statusCode: optionalString({ key: 'cStat', record: returnInfo }),
    reason: optionalString({ key: 'xMotivo', record: returnInfo }),
  }
}

function createDfeSummary({ document, situation, xml }: CreateDfeSummaryParams): DfeItem {
  return {
    nsu: '',
    schema: 'xml-import',
    xmlComprimido: '',
    xmlDecoded: xml,
    chaveNfe: document.accessKey,
    mod: document.model,
    emitenteCnpj: document.issuer.taxId,
    emitenteNome: document.issuer.name,
    valorTotal: Number(document.totals.invoice),
    dataEmissao: document.issuedAt,
    situacao: situation,
  }
}

function parseAccessKey(value: string): string {
  if (!ACCESS_KEY_PATTERN.test(value) || !isChaveDvValid(value)) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidAccessKey,
      message: 'Invalid NF-e access key',
    })
  }
  return value
}

function requireDecimal(params: RecordKeyParams): string {
  const value = requireString(params)
  if (!DECIMAL_PATTERN.test(value)) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'Invalid NF-e decimal value',
    })
  }
  return value
}

function optionalDecimal(params: RecordKeyParams): string | undefined {
  const value = optionalString(params)
  if (value === undefined) return undefined
  if (!DECIMAL_PATTERN.test(value)) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'Invalid NF-e decimal value',
    })
  }
  return value
}

function requireFirstString(params: RecordKeysParams): string {
  const value = optionalFirstString(params)
  if (value === undefined) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'NF-e required field is missing',
    })
  }
  return value
}

function requireFirstStringFromRecords({ key, records }: RecordsKeyParams): string {
  for (const record of records) {
    const value = optionalString({ key, record })
    if (value !== undefined) return value
  }
  throwImportError({
    code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
    message: 'NF-e required field is missing',
  })
}

function optionalFirstString({ keys, record }: RecordKeysParams): string | undefined {
  for (const key of keys) {
    const value = optionalString({ key, record })
    if (value !== undefined) return value
  }
  return undefined
}

function requireString(params: RecordKeyParams): string {
  const value = optionalString(params)
  if (value === undefined) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'NF-e required field is missing',
    })
  }
  return value
}

function optionalString({ key, record }: RecordKeyParams): string | undefined {
  if (!record) return undefined
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function requireRecord(value: unknown): XmlRecord {
  const record = optionalRecord(value)
  if (!record) {
    throwImportError({
      code: NFE_XML_IMPORT_ERROR_CODE.invalidStructure,
      message: 'Invalid NF-e XML structure',
    })
  }
  return record
}

function optionalRecord(value: unknown): XmlRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as XmlRecord
}

function toArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((entry) => entry !== undefined)
}

function resolveEventDescription(type: string): string | undefined {
  const descriptions: Readonly<Record<string, string>> = {
    '110111': 'Cancelamento',
    '110110': 'Carta de Correção',
    '110140': 'EPEC',
    '110120': 'Ficou sem Efeito',
    '110130': 'Autorização do Fisco',
    '210200': 'Ciência da Operação',
    '210210': 'Confirmação da Operação',
    '210220': 'Desconhecimento da Operação',
    '210240': 'Operação não Realizada',
  }
  return descriptions[type]
}

function throwImportError(params: ThrowImportErrorParams): never {
  throw new NfeXmlImportError(params)
}
