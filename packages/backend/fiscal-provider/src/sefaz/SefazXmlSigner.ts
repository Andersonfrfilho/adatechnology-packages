import { SignedXml } from 'xml-crypto'
import * as forge from 'node-forge'
import { FiscalError } from '../errors/FiscalError'

export type CertificateData = {
  readonly privateKeyPem: string
  readonly certificatePem: string
}

type SignedXmlResult = {
  readonly signedXml: string
  readonly certificatePem: string
}

export function loadCertificate(pfxBase64: string, password: string): CertificateData {
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

    return {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
      certificatePem: forge.pki.certificateToPem(certBag.cert),
    }
  } catch (error) {
    if (error instanceof FiscalError) throw error
    throw new FiscalError(
      `Falha ao carregar certificado A1: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      'CERT_LOAD_ERROR',
      error instanceof Error ? error.message : 'unknown',
      null
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
      null
    )
  }
}
