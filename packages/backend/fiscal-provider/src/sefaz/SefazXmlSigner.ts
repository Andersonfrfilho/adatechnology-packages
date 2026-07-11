import { SignedXml } from 'xml-crypto'
import * as forge from 'node-forge'
import { createHash } from 'crypto'
import { FiscalError } from '../errors/FiscalError'

export type CertificateData = {
  readonly privateKeyPem: string
  readonly certificatePem: string
}

type SignedXmlResult = {
  readonly signedXml: string
  readonly certificatePem: string
}

// Parse de PFX custa ~50ms — cache evita repetição por emissão em multi-tenant
const certificateCache = new Map<string, CertificateData>()

function buildCacheKey(pfxBase64: string, password: string): string {
  return createHash('sha256').update(`${pfxBase64}:${password}`).digest('hex')
}

export function loadCertificate(pfxBase64: string, password: string): CertificateData {
  const cacheKey = buildCacheKey(pfxBase64, password)
  const cached = certificateCache.get(cacheKey)
  if (cached) return cached

  try {
    const pfxDer = forge.util.decode64(pfxBase64)
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password)

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    if (!keyBag?.key) throw new Error('Chave privada não encontrada no certificado')

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]
    if (!certBag?.cert) throw new Error('Certificado público não encontrado no .pfx')

    const certData: CertificateData = {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
      certificatePem: forge.pki.certificateToPem(certBag.cert),
    }
    certificateCache.set(cacheKey, certData)
    return certData
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao carregar certificado A1: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'CERT_LOAD_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}

/** Remove o certificado do cache — útil ao trocar o .pfx sem reiniciar o processo */
export function evictCertificate(pfxBase64: string, password: string): void {
  certificateCache.delete(buildCacheKey(pfxBase64, password))
}

/** Indica se o certificado já está no cache, sem disparar o parse */
export function isCertificateCached(pfxBase64: string, password: string): boolean {
  return certificateCache.has(buildCacheKey(pfxBase64, password))
}

export function signCteXml(xml: string, certData: CertificateData): SignedXmlResult {
  try {
    const idMatch = xml.match(/infCTe Id="([^"]+)"/)
    if (!idMatch?.[1]) throw new Error('Id do infCTe não encontrado no XML')
    const cteId = idMatch[1]

    const sig = new SignedXml({
      privateKey: certData.privateKeyPem,
      publicCert: certData.certificatePem,
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    sig.addReference({
      xpath: `//*[@Id='${cteId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    })

    sig.computeSignature(xml, {
      location: { reference: `//*[@Id='${cteId}']`, action: 'after' },
    })

    return {
      signedXml: sig.getSignedXml(),
      certificatePem: certData.certificatePem,
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao assinar XML do CT-e: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}

export function signNfeEventoXml(xml: string, certData: CertificateData): SignedXmlResult {
  try {
    const idMatch = xml.match(/infEvento Id="([^"]+)"/)
    if (!idMatch?.[1]) throw new Error('Id do infEvento não encontrado no XML')
    const eventoId = idMatch[1]

    const sig = new SignedXml({
      privateKey: certData.privateKeyPem,
      publicCert: certData.certificatePem,
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    sig.addReference({
      xpath: `//*[@Id='${eventoId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    })

    sig.computeSignature(xml, {
      location: { reference: `//*[@Id='${eventoId}']`, action: 'after' },
    })

    return {
      signedXml: sig.getSignedXml(),
      certificatePem: certData.certificatePem,
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao assinar XML de evento NF-e: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}

export function signInutNFeXml(xml: string, certData: CertificateData): SignedXmlResult {
  try {
    const idMatch = xml.match(/infInut Id="([^"]+)"/)
    if (!idMatch?.[1]) throw new Error('Id do infInut não encontrado no XML')
    const inutId = idMatch[1]

    const sig = new SignedXml({
      privateKey: certData.privateKeyPem,
      publicCert: certData.certificatePem,
    })
    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
    sig.addReference({
      xpath: `//*[@Id='${inutId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    })
    sig.computeSignature(xml, { location: { reference: `//*[@Id='${inutId}']`, action: 'after' } })

    return { signedXml: sig.getSignedXml(), certificatePem: certData.certificatePem }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao assinar XML de inutilização: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}

export function signCteEventoXml(xml: string, certData: CertificateData): SignedXmlResult {
  try {
    const idMatch = xml.match(/infEvento Id="([^"]+)"/)
    if (!idMatch?.[1]) throw new Error('Id do infEvento CT-e não encontrado no XML')
    const eventoId = idMatch[1]

    const sig = new SignedXml({
      privateKey: certData.privateKeyPem,
      publicCert: certData.certificatePem,
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    sig.addReference({
      xpath: `//*[@Id='${eventoId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    })

    sig.computeSignature(xml, {
      location: { reference: `//*[@Id='${eventoId}']`, action: 'after' },
    })

    return {
      signedXml: sig.getSignedXml(),
      certificatePem: certData.certificatePem,
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao assinar XML de evento CT-e: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}

export function signNfseXml(xml: string, certData: CertificateData): SignedXmlResult {
  try {
    const idMatch = xml.match(/InfDeclaracaoPrestacaoServico Id="([^"]+)"/)
    if (!idMatch?.[1]) throw new Error('Id do InfDeclaracaoPrestacaoServico não encontrado no XML')
    const rpsId = idMatch[1]

    const sig = new SignedXml({
      privateKey: certData.privateKeyPem,
      publicCert: certData.certificatePem,
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    sig.addReference({
      xpath: `//*[@Id='${rpsId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    })

    sig.computeSignature(xml, {
      location: { reference: `//*[@Id='${rpsId}']`, action: 'after' },
    })

    return {
      signedXml: sig.getSignedXml(),
      certificatePem: certData.certificatePem,
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao assinar XML da NFS-e: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}

export function signNfceXml(xml: string, certData: CertificateData): SignedXmlResult {
  try {
    const nfeIdMatch = xml.match(/infNFe Id="([^"]+)"/)
    if (!nfeIdMatch?.[1]) throw new Error('Id do infNFe não encontrado no XML')
    const nfeId = nfeIdMatch[1]

    const sig = new SignedXml({
      privateKey: certData.privateKeyPem,
      publicCert: certData.certificatePem,
    })

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

    sig.addReference({
      xpath: `//*[@Id='${nfeId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    })

    sig.computeSignature(xml, {
      location: { reference: `//*[@Id='${nfeId}']`, action: 'after' },
    })

    return {
      signedXml: sig.getSignedXml(),
      certificatePem: certData.certificatePem,
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao assinar XML da NFC-e: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'XML_SIGN_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null,
    )
  }
}
