import * as forge from 'node-forge'

// OID ICP-Brasil
const OID_CNPJ = '2.16.76.1.3.3'
const OID_CPF  = '2.16.76.1.3.1'

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
    return buildResult(errors, warnings, false, false, false, false, false, false, false, false, '', '', undefined, undefined, new Date(0), new Date(0))
  }

  // ── Chave privada ────────────────────────────────────────────────────────────
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  const hasPrivateKey = !!(keyBag?.key)
  if (!hasPrivateKey) errors.push('Chave privada ausente no PFX — impossível assinar XML')

  // ── Certificado público ──────────────────────────────────────────────────────
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag  = certBags[forge.pki.oids.certBag]?.[0]
  const cert     = certBag?.cert
  if (!cert) {
    errors.push('Certificado público não encontrado no PFX')
    return buildResult(errors, warnings, hasPrivateKey, false, false, false, false, false, false, false, '', '', undefined, undefined, new Date(0), new Date(0))
  }

  const subject  = formatDn(cert.subject.attributes)
  const issuer   = formatDn(cert.issuer.attributes)
  const validFrom  = cert.validity.notBefore
  const expiresAt  = cert.validity.notAfter
  const now        = new Date()
  const isExpired     = now > expiresAt
  const isNotYetValid = now < validFrom

  if (isExpired)     errors.push(`Certificado expirado em ${expiresAt.toLocaleDateString('pt-BR')}`)
  if (isNotYetValid) errors.push(`Certificado ainda não válido — válido a partir de ${validFrom.toLocaleDateString('pt-BR')}`)

  // ── ICP-Brasil ───────────────────────────────────────────────────────────────
  const isIcpBrasil = issuer.includes('ICP-Brasil')
  if (!isIcpBrasil) errors.push('Certificado não é ICP-Brasil — SEFAZ não aceita')

  // ── CNPJ / CPF nos Subject Alternative Names (OIDs ICP-Brasil) ──────────────
  const { cnpj, cpf } = extractIcpBrasilIds(cert)
  const hasCnpj = !!cnpj
  const hasCpf  = !!cpf
  if (!hasCnpj && !hasCpf) {
    errors.push('CNPJ/CPF não encontrado no certificado (OIDs 2.16.76.1.3.3 / 2.16.76.1.3.1)')
  }

  // ── Key Usage ────────────────────────────────────────────────────────────────
  const keyUsage = getExtension(cert, 'keyUsage')
  const canSign  = !!(keyUsage?.digitalSignature)
  if (!canSign) errors.push('Key Usage: "Digital Signature" ausente — certificado não pode assinar XML')
  if (!keyUsage?.nonRepudiation) warnings.push('Key Usage: "Non Repudiation" ausente — alguns estados podem rejeitar')

  // ── Extended Key Usage ───────────────────────────────────────────────────────
  const extKeyUsage  = getExtension(cert, 'extKeyUsage')
  const hasClientAuth = !!(extKeyUsage?.clientAuth)

  // ── Aviso sobre OU=VideoConferencia (informativo apenas) ─────────────────────
  const ouValues = cert.subject.attributes
    .filter((a) => a.name === 'organizationalUnitName')
    .map((a) => String(a.value))
  if (ouValues.some((v) => /videoconfer/i.test(v))) {
    warnings.push('OU=VideoConferencia presente — campo informativo da emissão, não restringe uso fiscal')
  }

  const valid = errors.length === 0
  return buildResult(errors, warnings, hasPrivateKey, isExpired, isNotYetValid, isIcpBrasil, hasCnpj, hasCpf, canSign, hasClientAuth, subject, issuer, cnpj, cpf, expiresAt, validFrom)
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
  return attributes
    .map((a) => `${a.shortName ?? a.name}=${a.value}`)
    .join(', ')
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

  const altNames: Array<{ type: number; value?: string; oid?: string }> = (sanExt as { altNames?: Array<{ type: number; value?: string; oid?: string }> }).altNames ?? []

  // type 0 = otherName; value é a string DER-encoded que contém o OID + valor
  // Como node-forge não decodifica otherName automaticamente, extraímos por regex no sujeito
  // O CNPJ aparece no CN (ex: "EMPRESA LTDA:00000000000191") e no OU numérico
  let cnpj: string | undefined
  let cpf: string | undefined

  // Estratégia 1: CN contém "razão:CNPJ"
  const cnField = cert.subject.getField('CN')
  if (cnField) {
    const cnpjMatch = String(cnField.value).match(/:(\d{14})$/)
    if (cnpjMatch) cnpj = cnpjMatch[1]
    const cpfMatch = String(cnField.value).match(/:(\d{11})$/)
    if (!cnpj && cpfMatch) cpf = cpfMatch[1]
  }

  // Estratégia 2: OU numérico de 14 dígitos (CNPJ) ou 11 dígitos (CPF)
  if (!cnpj && !cpf) {
    const ous = cert.subject.attributes
      .filter((a) => a.name === 'organizationalUnitName')
      .map((a) => String(a.value))
    for (const ou of ous) {
      if (/^\d{14}$/.test(ou)) { cnpj = ou; break }
      if (/^\d{11}$/.test(ou)) { cpf  = ou; break }
    }
  }

  return { cnpj, cpf }
}
