import * as forge from 'node-forge'

import { CNPJ_PATTERN } from './SefazTaxId'

// OIDs ICP-Brasil do CNPJ (2.16.76.1.3.3) e do CPF (2.16.76.1.3.1) — citados no erro ao usuário

export type CertificateValidation = {
  readonly valid: boolean
  readonly errors: string[]
  readonly warnings: string[]
  readonly hasPrivateKey: boolean
  readonly isExpired: boolean
  readonly isNotYetValid: boolean
  readonly isIcpBrasil: boolean
  readonly hasCnpj: boolean
  readonly hasCpf: boolean
  readonly canSign: boolean
  readonly hasClientAuth: boolean
  readonly issuer: string
  readonly subject: string
  readonly cnpj?: string
  readonly cpf?: string
  readonly expiresAt: Date
  readonly validFrom: Date
}

export function validateCertificate(pfxBase64: string, password: string): CertificateValidation {
  const errors: string[] = []
  const warnings: string[] = []

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const pfxDer = forge.util.decode64(pfxBase64)
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password)
  } catch {
    errors.push('Falha ao abrir o arquivo PFX — verifique se a senha está correta')
    return buildResult(
      errors,
      warnings,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      '',
      '',
      undefined,
      undefined,
      new Date(0),
      new Date(0),
    )
  }

  // ── Chave privada ────────────────────────────────────────────────────────────
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  const hasPrivateKey = !!keyBag?.key
  if (!hasPrivateKey) errors.push('Chave privada ausente no PFX — impossível assinar XML')

  // ── Certificado público ──────────────────────────────────────────────────────
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  const cert = certBag?.cert
  if (!cert) {
    errors.push('Certificado público não encontrado no PFX')
    return buildResult(
      errors,
      warnings,
      hasPrivateKey,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      '',
      '',
      undefined,
      undefined,
      new Date(0),
      new Date(0),
    )
  }

  const subject = formatDn(cert.subject.attributes)
  const issuer = formatDn(cert.issuer.attributes)
  const validFrom = cert.validity.notBefore
  const expiresAt = cert.validity.notAfter
  const now = new Date()
  const isExpired = now > expiresAt
  const isNotYetValid = now < validFrom

  if (isExpired) errors.push(`Certificado expirado em ${expiresAt.toLocaleDateString('pt-BR')}`)
  if (isNotYetValid)
    errors.push(`Certificado ainda não válido — válido a partir de ${validFrom.toLocaleDateString('pt-BR')}`)

  // ── ICP-Brasil ───────────────────────────────────────────────────────────────
  const isIcpBrasil = issuer.includes('ICP-Brasil')
  if (!isIcpBrasil) errors.push('Certificado não é ICP-Brasil — SEFAZ não aceita')

  // ── CNPJ / CPF nos Subject Alternative Names (OIDs ICP-Brasil) ──────────────
  const { cnpj, cpf } = extractIcpBrasilIds(cert)
  const hasCnpj = !!cnpj
  const hasCpf = !!cpf
  if (!hasCnpj && !hasCpf) {
    errors.push('CNPJ/CPF não encontrado no certificado (OIDs 2.16.76.1.3.3 / 2.16.76.1.3.1)')
  }

  // ── Key Usage ────────────────────────────────────────────────────────────────
  const keyUsage = getExtension(cert, 'keyUsage')
  const canSign = !!keyUsage?.digitalSignature
  if (!canSign) errors.push('Key Usage: "Digital Signature" ausente — certificado não pode assinar XML')
  if (!keyUsage?.nonRepudiation) warnings.push('Key Usage: "Non Repudiation" ausente — alguns estados podem rejeitar')

  // ── Extended Key Usage ───────────────────────────────────────────────────────
  const extKeyUsage = getExtension(cert, 'extKeyUsage')
  const hasClientAuth = !!extKeyUsage?.clientAuth

  // ── Aviso sobre OU=VideoConferencia (informativo apenas) ─────────────────────
  const ouValues = cert.subject.attributes
    .filter((a) => a.name === 'organizationalUnitName')
    .map((a) => String(a.value))
  if (ouValues.some((v) => /videoconfer/i.test(v))) {
    warnings.push('OU=VideoConferencia presente — campo informativo da emissão, não restringe uso fiscal')
  }

  return buildResult(
    errors,
    warnings,
    hasPrivateKey,
    isExpired,
    isNotYetValid,
    isIcpBrasil,
    hasCnpj,
    hasCpf,
    canSign,
    hasClientAuth,
    subject,
    issuer,
    cnpj,
    cpf,
    expiresAt,
    validFrom,
  )
}

function buildResult(
  errors: string[],
  warnings: string[],
  hasPrivateKey: boolean,
  isExpired: boolean,
  isNotYetValid: boolean,
  isIcpBrasil: boolean,
  hasCnpj: boolean,
  hasCpf: boolean,
  canSign: boolean,
  hasClientAuth: boolean,
  subject: string,
  issuer: string,
  cnpj: string | undefined,
  cpf: string | undefined,
  expiresAt: Date,
  validFrom: Date,
): CertificateValidation {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasPrivateKey,
    isExpired,
    isNotYetValid,
    isIcpBrasil,
    hasCnpj,
    hasCpf,
    canSign,
    hasClientAuth,
    issuer,
    subject,
    cnpj,
    cpf,
    expiresAt,
    validFrom,
  }
}

function formatDn(attributes: forge.pki.CertificateField[]): string {
  return attributes.map((a) => `${a.shortName ?? a.name}=${a.value}`).join(', ')
}

function getExtension(cert: forge.pki.Certificate, name: string): Record<string, boolean> | undefined {
  const ext = cert.extensions?.find((e: { name?: string }) => e.name === name)
  return ext as Record<string, boolean> | undefined
}

function extractIcpBrasilIds(cert: forge.pki.Certificate): { cnpj?: string; cpf?: string } {
  // Os OIDs ICP-Brasil ficam no Subject Alternative Name como otherName
  // node-forge expõe extensões raw — buscamos pelo OID no ASN.1 subjacente
  const sanExt = cert.extensions?.find((e: { name?: string }) => e.name === 'subjectAltName')
  if (!sanExt) return {}

  // O node-forge não decodifica o `otherName` do SAN, que é onde os OIDs ICP-Brasil moram; o valor
  // sai do sujeito, onde o CNPJ aparece no CN (ex: "EMPRESA LTDA:12ABC34501DE35") e no OU
  const cnField = cert.subject.getField('CN')
  const organizationalUnits = cert.subject.attributes
    .filter((a) => a.name === 'organizationalUnitName')
    .map((a) => String(a.value))

  return parseIcpBrasilSubject({
    commonName: cnField ? String(cnField.value) : undefined,
    organizationalUnits,
  })
}

const CN_CNPJ_SUFFIX_PATTERN = /:([A-Z0-9]{12}[0-9]{2})$/u
const CN_CPF_SUFFIX_PATTERN = /:([0-9]{11})$/u
const OU_CPF_PATTERN = /^[0-9]{11}$/u

/**
 * O sujeito do certificado ICP-Brasil separado do node-forge para ser testável sem um PFX real.
 * O CNPJ vem do formato alfanumérico da IN RFB 2229/2024; o CPF continua com 11 dígitos, e é o
 * tamanho que discrimina os dois — não a presença de letra.
 */
export function parseIcpBrasilSubject(params: {
  readonly commonName?: string
  readonly organizationalUnits: readonly string[]
}): { cnpj?: string; cpf?: string } {
  let cnpj: string | undefined
  let cpf: string | undefined

  // Estratégia 1: CN contém "razão:CNPJ"
  if (params.commonName) {
    const cnpjMatch = params.commonName.match(CN_CNPJ_SUFFIX_PATTERN)
    if (cnpjMatch) cnpj = cnpjMatch[1]
    const cpfMatch = params.commonName.match(CN_CPF_SUFFIX_PATTERN)
    if (!cnpj && cpfMatch) cpf = cpfMatch[1]
  }

  // Estratégia 2: OU com 14 posições (CNPJ) ou 11 dígitos (CPF)
  if (!cnpj && !cpf) {
    for (const ou of params.organizationalUnits) {
      if (CNPJ_PATTERN.test(ou)) {
        cnpj = ou
        break
      }
      if (OU_CPF_PATTERN.test(ou)) {
        cpf = ou
        break
      }
    }
  }

  return { cnpj, cpf }
}
