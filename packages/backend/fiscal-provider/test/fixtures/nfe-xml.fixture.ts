/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

export const NFE_ACCESS_KEY = '35260711222333000181550010000000011000000013'
export const SECOND_NFE_ACCESS_KEY = '35260711222333000181550010000000021000000029'
export const ISSUER_CNPJ = '11222333000181'
export const RECIPIENT_CNPJ = '99888777000100'
export const CARRIER_CNPJ = '55444333000161'

type BuildNfeXmlParams = {
  readonly accessKey?: string
}

type BuildAuthorizedNfeXmlParams = BuildNfeXmlParams & {
  readonly protocolAccessKey?: string
}

export function buildAuthorizedNfeXml(params: BuildAuthorizedNfeXmlParams = {}): string {
  const accessKey = params.accessKey ?? NFE_ACCESS_KEY
  const protocolAccessKey = params.protocolAccessKey ?? accessKey

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">',
    buildNfeNode({ accessKey }),
    '<protNFe versao="4.00"><infProt>',
    '<tpAmb>2</tpAmb><verAplic>TEST-1.0</verAplic>',
    `<chNFe>${protocolAccessKey}</chNFe>`,
    '<dhRecbto>2026-07-20T12:05:00-03:00</dhRecbto>',
    '<nProt>135260000000001</nProt><digVal>fixture-digest</digVal>',
    '<cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo>',
    '</infProt></protNFe>',
    '</nfeProc>',
  ].join('')
}

export function buildBareNfeXml(params: BuildNfeXmlParams = {}): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    buildNfeNode({ accessKey: params.accessKey ?? NFE_ACCESS_KEY }),
  ].join('')
}

export function buildNfeEventXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">',
    '<evento versao="1.00"><infEvento Id="ID110111',
    NFE_ACCESS_KEY,
    '01">',
    '<cOrgao>35</cOrgao><tpAmb>2</tpAmb>',
    `<CNPJ>${ISSUER_CNPJ}</CNPJ><chNFe>${NFE_ACCESS_KEY}</chNFe>`,
    '<dhEvento>2026-07-20T13:00:00-03:00</dhEvento>',
    '<tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento>',
    '<verEvento>1.00</verEvento>',
    '<detEvento versao="1.00"><descEvento>Cancelamento</descEvento>',
    '<nProt>135260000000001</nProt>',
    '<xJust>Cancelamento solicitado em fixture sintetica</xJust>',
    '</detEvento></infEvento></evento>',
    '<retEvento versao="1.00"><infEvento>',
    '<tpAmb>2</tpAmb><verAplic>TEST-1.0</verAplic><cOrgao>35</cOrgao>',
    '<cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo>',
    `<chNFe>${NFE_ACCESS_KEY}</chNFe><tpEvento>110111</tpEvento>`,
    '<xEvento>Cancelamento registrado</xEvento><nSeqEvento>1</nSeqEvento>',
    '<dhRegEvento>2026-07-20T13:00:01-03:00</dhRegEvento>',
    '<nProt>135260000000002</nProt>',
    '</infEvento></retEvento>',
    '</procEventoNFe>',
  ].join('')
}

function buildNfeNode({ accessKey }: Required<BuildNfeXmlParams>): string {
  return [
    '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">',
    `<infNFe Id="NFe${accessKey}" versao="4.00">`,
    '<ide>',
    '<cUF>35</cUF><cNF>00000001</cNF>',
    '<natOp>VENDA DE PRODUCAO DO ESTABELECIMENTO</natOp>',
    '<mod>55</mod><serie>1</serie><nNF>1</nNF>',
    '<dhEmi>2026-07-20T12:00:00-03:00</dhEmi>',
    '<tpNF>1</tpNF><idDest>2</idDest><cMunFG>3550308</cMunFG>',
    '<tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>3</cDV>',
    '<tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>0</indFinal>',
    '<indPres>9</indPres><procEmi>0</procEmi><verProc>fixture-1.0</verProc>',
    '</ide>',
    '<emit>',
    `<CNPJ>${ISSUER_CNPJ}</CNPJ>`,
    '<xNome>EMITENTE TESTE LTDA</xNome><xFant>EMITENTE FIXTURE</xFant>',
    '<enderEmit><xLgr>Rua Origem</xLgr><nro>100</nro><xCpl>Galpao A</xCpl>',
    '<xBairro>Centro</xBairro><cMun>3550308</cMun><xMun>Sao Paulo</xMun>',
    '<UF>SP</UF><CEP>01001000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais>',
    '<fone>1133334444</fone></enderEmit>',
    '<IE>111111111111</IE><CRT>3</CRT>',
    '</emit>',
    '<dest>',
    `<CNPJ>${RECIPIENT_CNPJ}</CNPJ>`,
    '<xNome>DESTINATARIO TESTE LTDA</xNome>',
    '<enderDest><xLgr>Rua Destino</xLgr><nro>200</nro>',
    '<xBairro>Centro</xBairro><cMun>3304557</cMun><xMun>Rio de Janeiro</xMun>',
    '<UF>RJ</UF><CEP>20040002</CEP><cPais>1058</cPais><xPais>BRASIL</xPais>',
    '<fone>2133334444</fone></enderDest>',
    '<indIEDest>1</indIEDest><IE>222222222222</IE>',
    '</dest>',
    '<det nItem="1"><prod>',
    '<cProd>SKU-001</cProd><cEAN>SEM GTIN</cEAN>',
    '<xProd>PRODUTO SINTETICO PARA TESTE</xProd>',
    '<NCM>84713012</NCM><CFOP>6101</CFOP><uCom>UN</uCom>',
    '<qCom>2.5000</qCom><vUnCom>100.1234</vUnCom><vProd>250.3085</vProd>',
    '<cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib>',
    '<qTrib>2.5000</qTrib><vUnTrib>100.1234</vUnTrib>',
    '<indTot>1</indTot>',
    '</prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST>',
    '<modBC>3</modBC><vBC>250.3085</vBC><pICMS>18.0000</pICMS>',
    '<vICMS>45.0555</vICMS></ICMS00></ICMS></imposto></det>',
    '<total><ICMSTot>',
    '<vBC>250.3085</vBC><vICMS>45.0555</vICMS><vICMSDeson>0.0000</vICMSDeson>',
    '<vFCP>0.0000</vFCP><vBCST>0.0000</vBCST><vST>0.0000</vST>',
    '<vFCPST>0.0000</vFCPST><vFCPSTRet>0.0000</vFCPSTRet>',
    '<vProd>250.3085</vProd><vFrete>10.5000</vFrete><vSeg>1.2500</vSeg>',
    '<vDesc>2.0000</vDesc><vII>0.0000</vII><vIPI>0.0000</vIPI>',
    '<vIPIDevol>0.0000</vIPIDevol><vPIS>0.0000</vPIS><vCOFINS>0.0000</vCOFINS>',
    '<vOutro>0.7500</vOutro><vNF>260.8085</vNF><vTotTrib>45.0555</vTotTrib>',
    '</ICMSTot></total>',
    '<transp><modFrete>0</modFrete><transporta>',
    `<CNPJ>${CARRIER_CNPJ}</CNPJ>`,
    '<xNome>TRANSPORTADORA TESTE LTDA</xNome><IE>333333333333</IE>',
    '<xEnder>Rodovia Teste 300</xEnder><xMun>Sao Paulo</xMun><UF>SP</UF>',
    '</transporta><vol><qVol>2</qVol><esp>CAIXA</esp><marca>FIXTURE</marca>',
    '<nVol>1-2</nVol><pesoL>10.500</pesoL><pesoB>12.750</pesoB></vol></transp>',
    '<cobr><fat><nFat>FAT-001</nFat><vOrig>260.8085</vOrig>',
    '<vDesc>0.0000</vDesc><vLiq>260.8085</vLiq></fat></cobr>',
    '<infAdic><infCpl>OBSERVACAO SINTETICA PARA CONTRATO</infCpl></infAdic>',
    '</infNFe></NFe>',
  ].join('')
}
