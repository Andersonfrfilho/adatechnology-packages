/**
 * Mock SEFAZ — servidor SOAP local para testes sem certificado fiscal.
 *
 * Simula NFC-e e NF-e homologação (cStat 107/100/135).
 * Não valida assinatura XML nem certificado — apenas retorna respostas válidas.
 *
 * Uso:
 *   bun run scripts/mock-sefaz.ts
 *   MOCK_SEFAZ_URL=http://localhost:9090 bun run test:nfce
 */

const PORT = Number(process.env.MOCK_SEFAZ_PORT ?? 9090)

const now = (): string => new Date().toISOString().replace('Z', '-03:00').slice(0, 22) + '-03:00'

function extractChave(body: string): string {
  const match = body.match(/Id="NFe([^"]{44})"/) ?? body.match(/<chNFe>([^<]{44})<\/chNFe>/)
  return match?.[1] ?? '35000000000000000000650010000000010000000018'
}

function buildNfeProtocolo(): string {
  const ts = Date.now().toString().slice(-12).padStart(18, '1')
  return `135${ts}`
}

// ─── Respostas SOAP ────────────────────────────────────────────────────────────

function responseStatusOk(isNfe: boolean): string {
  const tag = isNfe ? 'nfeResultMsg' : 'nfceResultMsg'
  const ns = isNfe
    ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4'
    : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceStatusServico4'
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <${tag} xmlns="${ns}">
      <retConsStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <tpAmb>2</tpAmb>
        <verAplic>MOCK_SEFAZ_1.0</verAplic>
        <cStat>107</cStat>
        <xMotivo>Servico em Operacao</xMotivo>
        <cUF>35</cUF>
        <dhRecbto>${now()}</dhRecbto>
        <tMed>1</tMed>
      </retConsStatServ>
    </${tag}>
  </soap12:Body>
</soap12:Envelope>`
}

function responseAutorizacaoOk(body: string, isNfe: boolean): string {
  const chave = extractChave(body)
  const nProt = buildNfeProtocolo()
  const tag = isNfe ? 'nfeResultMsg' : 'nfceResultMsg'
  const ns = isNfe
    ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao4'
    : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4'
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <${tag} xmlns="${ns}">
      <retEnviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <tpAmb>2</tpAmb>
        <verAplic>MOCK_SEFAZ_1.0</verAplic>
        <cStat>104</cStat>
        <xMotivo>Lote processado</xMotivo>
        <cUF>35</cUF>
        <dhRecbto>${now()}</dhRecbto>
        <protNFe versao="4.00">
          <infProt>
            <tpAmb>2</tpAmb>
            <verAplic>MOCK_SEFAZ_1.0</verAplic>
            <chNFe>${chave}</chNFe>
            <dhRecbto>${now()}</dhRecbto>
            <nProt>${nProt}</nProt>
            <digVal>mockDigVal==</digVal>
            <cStat>100</cStat>
            <xMotivo>Autorizado o uso da NF-e</xMotivo>
          </infProt>
        </protNFe>
      </retEnviNFe>
    </${tag}>
  </soap12:Body>
</soap12:Envelope>`
}

function responseCancelamentoOk(body: string, isNfe: boolean): string {
  const chave = extractChave(body)
  const nProt = buildNfeProtocolo()
  const tag = isNfe ? 'nfeResultMsg' : 'nfceResultMsg'
  const ns = isNfe
    ? 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4'
    : 'http://www.portalfiscal.inf.br/nfe/wsdl/NfceRecepcaoEvento4'
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <${tag} xmlns="${ns}">
      <retEnvEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>1</idLote>
        <tpAmb>2</tpAmb>
        <verAplic>MOCK_SEFAZ_1.0</verAplic>
        <cOrgao>35</cOrgao>
        <cStat>128</cStat>
        <xMotivo>Lote de Evento Processado</xMotivo>
        <retEvento versao="1.00">
          <infEvento>
            <tpAmb>2</tpAmb>
            <verAplic>MOCK_SEFAZ_1.0</verAplic>
            <cOrgao>35</cOrgao>
            <cStat>135</cStat>
            <xMotivo>Evento registrado e vinculado a NF-e</xMotivo>
            <chNFe>${chave}</chNFe>
            <dhRegEvento>${now()}</dhRegEvento>
            <nProt>${nProt}</nProt>
          </infEvento>
        </retEvento>
      </retEnvEvento>
    </${tag}>
  </soap12:Body>
</soap12:Envelope>`
}

// ─── Roteamento ───────────────────────────────────────────────────────────────

function route(path: string, body: string): Response {
  const xml = (() => {
    const isNfe = path.includes('Nfe') && !path.includes('Nfce')

    if (path.includes('StatusServico')) return responseStatusOk(isNfe)
    if (path.includes('Autorizacao'))  return responseAutorizacaoOk(body, isNfe)
    if (path.includes('RecepcaoEvento') || path.includes('recepcaoevento'))
      return responseCancelamentoOk(body, isNfe)

    return null
  })()

  if (!xml) {
    console.log(`  [mock] 404 — path desconhecido: ${path}`)
    return new Response('Not Found', { status: 404 })
  }

  console.log(`  [mock] 200 — ${path.split('/').pop()}`)
  return new Response(xml, {
    headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
  })
}

// ─── Servidor ────────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.text() : ''
    return route(url.pathname, body)
  },
})

console.log(`\nMock SEFAZ rodando em http://localhost:${PORT}`)
console.log('Endpoints disponíveis:')
console.log(`  POST /ws/NfceStatusServico4.asmx   → cStat 107`)
console.log(`  POST /ws/NfceAutorizacao4.asmx     → cStat 100 (autorizado)`)
console.log(`  POST /ws/NfceRecepcaoEvento4.asmx  → cStat 135 (cancelado)`)
console.log(`  POST /ws/NfeStatusServico4.asmx    → cStat 107`)
console.log(`  POST /ws/NfeAutorizacao4.asmx      → cStat 100 (autorizado)`)
console.log('\nUso nos testes:')
console.log(`  MOCK_SEFAZ_URL=http://localhost:${PORT} bun run test:nfce\n`)
