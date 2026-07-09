# Validação dos Modelos Fiscais — fiscal-provider

Documento de rastreio das validações realizadas em ambiente real (homologação/produção).
Marque cada item conforme for validado.

Legenda: ✅ Validado | 🔄 Implementado, aguardando teste | ❌ Não implementado | ⚠️ Parcial

---

## 1. NF-e — Nota Fiscal Eletrônica (modelo 55)

**Provider:** `SefazNfeProvider`  
**Gateway:** SEFAZ estadual (SOAP 1.2 + mTLS)  
**Destinatário:** PJ (CNPJ) ou PF (CPF)

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 1.1 | Emissão com destinatário CPF — homologação SEFAZ SP | ✅ | cStat 100, protocolo `135260006231352`, chave `35260661156864000191550010000000091528920846` |
| 1.2 | Emissão com destinatário CNPJ — homologação | 🔄 | Implementado, não testado |
| 1.3 | Emissão — produção real | 🔄 | Aguarda habilitação produção |
| 1.4 | Cancelamento — homologação | ✅ | cStat 135, protocolo `135260006239385`, chave `35260661156864000191550010000000091528920846` |
| 1.5 | Cancelamento — validação de chave inválida (guard) | 🔄 | Implementado com log |
| 1.6 | Cancelamento — validação de justificativa curta (guard) | 🔄 | Implementado com log |
| 1.7 | `testConnection` — status SEFAZ NF-e SP homologação | 🔄 | Implementado |
| 1.8 | Schema XML validado contra PL009 (XSD local) | ✅ | 100% válido após correção de `serie`, `vDesc`, `xNome` homologação |

**Regras críticas descobertas:**

- `serie` sem zeros à esquerda — PL009 rejeita `'001'`, use `'1'` (cStat 225)
- `vDesc` sempre presente em `ICMSTot`, mesmo quando zero (cStat 225)
- `xNome` destinatário substituído automaticamente em homologação (cStat 598 caso contrário)
- Chave com `mod: '55'` — padrão NFC-e usa `'65'` (cStat 502)
- IE do emitente deve estar cadastrada no SEFAZ do estado — CNPJ Simples sem IE deixa campo vazio → `<IE>ISENTO</IE>` (cStat 209)
- XML de evento de cancelamento deve ser **assinado digitalmente** antes de envio — sem assinatura → cStat 225 (schema) (corrigido: `signNfeEventoXml` em `SefazXmlSigner.ts`)
- XML de evento e envelope SOAP devem ser **compactos** (sem whitespace entre tags) — SP rejeita com cStat 588

---

## 2. NFC-e — Nota Fiscal de Consumidor Eletrônica (modelo 65)

**Provider:** `SefazNfceProvider`  
**Gateway:** SEFAZ estadual (SOAP 1.2 + mTLS)  
**Destinatário:** Consumidor final (sem identificação obrigatória)

> ⚠️ **SP NÃO usa NFC-e.** São Paulo adotou SAT Fiscal para varejo e NF-e modelo 55 para demais operações.
> O provider agora rejeita `uf: 'SP'` com `errorCode: 'UF_NOT_SUPPORTED'` antes de qualquer chamada à SEFAZ.
> Estados confirmados com suporte: MG, RS, PR (própria SEFAZ) + demais via SVRS.

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 2.1 | Emissão sem identificação de destinatário — homologação | 🔄 | Implementado |
| 2.2 | Emissão com CPF destinatário — homologação | 🔄 | Implementado |
| 2.3 | Emissão — produção real | 🔄 | Aguarda CSC produção |
| 2.4 | Cancelamento — homologação | 🔄 | Implementado |
| 2.5 | `testConnection` — status SEFAZ NFC-e | 🔄 | Implementado |
| 2.6 | QR Code gerado e validável pelo app da SEFAZ | 🔄 | Implementado, não testado visualmente |
| 2.7 | DANFCE gerado com dados corretos | 🔄 | Implementado |
| 2.8 | Schema XML validado contra PL009 (XSD local) | ✅ | 100% válido após correção de `serie`, `vDesc` e `<IE>` ausente |

**Bugs corrigidos antes do primeiro teste SEFAZ (evitam cStat 225 certo):**

- `serie` com `padStart(3,'0')` gerava `'001'` → corrigido para `parseInt` sem zeros (igual NF-e)
- `vDesc` ausente quando `discountAmount === 0` → agora sempre presente em `ICMSTot`
- `<IE>` do emitente ausente no `<emit>` → adicionado após `</enderEmit>`, antes de `<CRT>`

**Pendências antes de validar contra SEFAZ:**

- Obter `cscId` e `cscToken` de homologação no portal SEFAZ do estado
- Confirmar que o número de série CSC é diferente entre homologação e produção

---

## 3. SAT — Sistema Autenticador e Transmissor (SP)

**Provider:** `SatProvider`  
**Gateway:** Middleware local HTTP (equipamento físico SAT)  
**Restrição:** Exclusivo São Paulo, requer hardware

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 3.1 | `testConnection` — ping middleware SAT local | 🔄 | Implementado |
| 3.2 | Emissão — equipamento SAT físico | 🔄 | Implementado, requer hardware |
| 3.3 | Cancelamento — SAT físico | 🔄 | Implementado, requer hardware |
| 3.4 | Mapeamento de formas de pagamento para código SAT | 🔄 | Implementado (`toSatPaymentCode`) |

**Pendências antes de validar:**

- Acesso a equipamento SAT físico (ou emulador)
- URL do middleware SAT local (`FISCAL_SAT_URL`)
- `activationCode` e `signatureAc` do equipamento

---

## 4. NFS-e — Nota Fiscal de Serviços Eletrônica (ABRASF)

**Provider:** `NfseProvider`  
**Gateway:** Webservice municipal direto (SOAP, URL variável por prefeitura)  
**Padrão:** ABRASF 2.04

> ⚠️ **ISS Net Online Ribeirão Preto tem restrição de IP.**  
> O endpoint `https://ribeiraopreto.issnetonline.com.br/ISS/apirecepcaoservico.asmx` existe  
> (HTTP 301 confirma o path), mas HTTPS retorna 404 vazio para IPs não autorizados.  
> Só aceita requisições de IPs homologados (Nota RP, softwares certificados pela prefeitura).  
> Para produção: deploy em servidor ou aguardar migração Nota RP v3 para RP.

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 4.1 | Emissão simples — homologação prefeitura | 🔄 | Implementado |
| 4.2 | Substituição de NFS-e (`nfseSubstituida`) | 🔄 | Implementado |
| 4.3 | Cancelamento — homologação | 🔄 | Implementado |
| 4.4 | `testConnection` — conectividade webservice municipal | ⚠️ | Retorna ok=true (status 404 < 500), mas endpoint é IP-restrito |
| 4.5 | Validado em Ribeirão Preto SP (cód. 3543402) | ⚠️ | Endpoint correto, bloqueado por IP — requer servidor autorizado |
| 4.6 | Validado em São Paulo SP (cód. 3550308) | 🔄 | Não testado |

**Bugs corrigidos durante validação:**

- `signNfseXml` ausente — provider chamava `signNfceXml` que busca `infNFe` (NFC-e) em vez de `InfDeclaracaoPrestacaoServico` (ABRASF). Função específica `signNfseXml` criada em `SefazXmlSigner.ts`.

**Dados confirmados para Ribeirão Preto:**

- CNPJ: `61156864000191`, IM: `20935293`, IBGE: `3543402`
- Webservice: `https://ribeiraopreto.issnetonline.com.br/ISS/apirecepcaoservico.asmx`
- Certificado A1: e-CNPJ AFR Fernandes, válido até 05/11/2026

**Pendências antes de validar emissão:**

- Deploy em servidor com IP autorizado pela prefeitura RP  
- **OU** aguardar migração Nota RP v3 para Ribeirão Preto (recomendado)  
- Código de serviço LC116 e alíquota ISS do município

---

## 5. NFS-e via Nota RP

**Provider:** `NotaRpNfseProvider`  
**Gateway:** API REST Nota RP (`notarp.com.br`)  
**Cobertura:** Multi-município (resolve URL por IBGE internamente)

> ⚠️ **Ribeirão Preto (ISS Net Online v2) NÃO está migrado para o Nota RP v3.**  
> O token da conta AFR Fernandes é válido (autenticação confirmada via curl), mas a API retorna HTTP 403:  
> `"Esta empresa ainda não foi migrada para a versão v3 da API. Utilize a versão v2."`  
> **Alternativa imediata:** usar `NfseProvider` (ABRASF direto) com a URL do ISS Net Online RP.  
> O provider agora detecta esse erro e retorna mensagem acionável em vez de falha genérica de auth.

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 5.1 | Emissão com tomador PF (CPF) — sandbox | 🔄 | Implementado |
| 5.2 | Emissão com tomador PJ (CNPJ) — sandbox | 🔄 | Implementado |
| 5.3 | Emissão com tomador estrangeiro — sandbox | 🔄 | Implementado |
| 5.4 | Cancelamento — sandbox | 🔄 | Implementado |
| 5.5 | `testConnection` — autenticação Nota RP | ⚠️ | Token/CNPJ/IM válidos, mas RP bloqueado na v3 |
| 5.6 | Webhook de retorno recebido com sucesso | 🔄 | Não testado end-to-end |

**Bugs corrigidos durante validação:**

- Tipos `NotaRpEmitirResponse`, `NotaRpCancelarResponse`, `NotaRpEmpresaListarResponse` usavam campos em português (`sucesso`, `mensagem`, `erros`) mas a API retorna em inglês (`success`, `message`, `errors`) — corrigido

**Pendências antes de validar emissão:**

- Aguardar migração do município para v3 pela Nota Control  
- **OU** usar `NfseProvider` (ABRASF) com URL ISS Net Online de Ribeirão Preto
- Código de tributação nacional e municipal do serviço a emitir

---

## 6. Infraestrutura do Provider (cross-corte)

| # | Item | Status | Observação |
|---|------|--------|------------|
| 6.1 | Certificado A1 — parse PFX via node-forge | ✅ | Validado com cert ICP-Brasil real |
| 6.2 | Cache de certificado (sha256-keyed, ~50ms savings) | ✅ | Implementado e integrado |
| 6.3 | `evictCertificate` — invalidação manual do cache | ✅ | Exportado em `src/index.ts` |
| 6.4 | `validateCertificate` — diagnóstico completo do PFX | ✅ | Testa validade, ICP-Brasil, CNPJ/CPF, Key Usage |
| 6.5 | Retry com backoff exponencial | ✅ | `SefazRetry.ts` |
| 6.6 | Logs estruturados JSON com `obfuscateMeta` | ✅ | CNPJ, CPF, chaveAcesso, `<xNome>` mascarados |
| 6.7 | Mensagens de log em constantes (`SefazLogMessages.constant.ts`) | ✅ | NFE_LOG, NFCE_LOG, CERT_LOG |
| 6.8 | JSDoc em todos os tipos exportados (`types.ts`) | ✅ | Incluindo links siscomex, exemplos de cStat, regras de campo |
| 6.9 | `CREDENCIAIS_TESTE.md` — guia de setup por modelo | ✅ | Sem dados reais, apenas placeholders |
| 6.10 | `CREDENCIAMENTO_NFCE.md` — guia credenciamento SEFAZ | ✅ | Sanitizado |
| 6.11 | `CHANGELOG.md` — v0.0.2 com todas as correções schema | ✅ | |
| 6.12 | `FiscalProviderFactory` — criação por `model` string | ✅ | nfce, nfe, sat, nfse, nfse-notarp, cte (nfe-distribuicao não usa factory) |
| 6.13 | Testes E2E via `scripts/test-fiscal.ts` | 🔄 | Roda, mas sem CI automatizado |

---

## 7. CT-e — Conhecimento de Transporte Eletrônico (modelo 57)

**Provider:** `SefazCteProvider`  
**Gateway:** SEFAZ estadual (SOAP 1.2 + mTLS) — SP próprio; demais via SVRS (RS)  
**Destinatário:** Transportadoras (RNTRC obrigatório)

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 7.1 | `testConnection` — status SEFAZ CT-e SP homologação | 🔄 | Implementado, não testado (requer RNTRC) |
| 7.2 | Emissão modal rodoviário — homologação | 🔄 | Implementado |
| 7.3 | Emissão modal aéreo — homologação | 🔄 | Implementado |
| 7.4 | Emissão modal aquaviário — homologação | 🔄 | Implementado |
| 7.5 | Emissão modal ferroviário — homologação | 🔄 | Implementado |
| 7.6 | Cancelamento CT-e — homologação | 🔄 | Implementado |
| 7.7 | Assinatura digital CT-e (`signCteXml`) | ✅ | Mesma estrutura RSA-SHA1 + C14N da NF-e; testado via typecheck |
| 7.8 | Assinatura digital evento CT-e (`signCteEventoXml`) | ✅ | Implementado |
| 7.9 | Build de chave 44 dígitos CT-e (`buildChaveCte`) | ✅ | Mod11, cUF+AAMM+CNPJ+57+serie+nCT+tpEmis+cCT+cDV |
| 7.10 | Endpoints SP, MG, PR, RS, BA (servidor próprio) | ✅ | `CteConstants.ts` — demais estados via SVRS |

**Arquivos:**
- `src/sefaz/CteConstants.ts` — endpoints, UF→IBGE, SVRS fallback
- `src/sefaz/CteXmlBuilder.ts` — builders XML para todos os modais + ICMS discriminado por CST
- `src/sefaz/CteSoapClient.ts` — sendCteAutorizacao, sendCteStatusServico, sendCteCancelamento
- `src/providers/SefazCteProvider.ts` — implementa FiscalProvider

**Pendências antes de validar:**
- RNTRC (Registro Nacional de Transportadores Rodoviários de Cargas)
- Série CT-e do estabelecimento no SEFAZ
- Dados reais da carga (remetente, destinatário, documentos da carga)

---

## 8. NF-e Distribuição DFe — Consulta de documentos vinculados ao CNPJ

**Provider:** `NfeDistribuicaoProvider` (não usa `FiscalProvider` interface — instanciar diretamente)  
**Gateway:** SEFAZ Nacional (`nfe.fazenda.gov.br`) — mTLS obrigatório  
**Uso:** Transportadoras e destinatários consultando NF-es onde seu CNPJ figura

| # | Cenário | Status | Observação |
|---|---------|--------|------------|
| 8.1 | `consultarDFe` paginação incremental — homologação | ✅ | cStat 137 (sem docs em hom), cStat 656 rate limit identificado e tratado |
| 8.2 | `consultarDFe` paginação incremental — produção | 🔄 | Rate limit ativo (1h/CNPJ após cStat 137) — revalidar após expirar |
| 8.3 | `consultarPorNsu` — busca NSU específico (`<consNSU>`) | 🔄 | Implementado, não testado contra SEFAZ |
| 8.4 | `consultarPorChave` — busca por chave 44 dígitos (`<consChNFe>`) | 🔄 | Implementado, não testado contra SEFAZ |
| 8.5 | `importarXml` / `importarNfeXml` — parse de XML externo | ✅ | Testado com nfeProc, NFe bare e procEventoNFe |
| 8.6 | Parse `resNFe` (resumo) — extração de campos | ✅ | chaveNfe, emitenteCnpj, emitenteNome, valorTotal, dataEmissao, situacao |
| 8.7 | Parse `procNFe` (XML completo autorizado) | ✅ | Mesmo mapeamento, situacao='1' |
| 8.8 | Parse `resEvento` (resumo de evento) | ✅ | tipoEvento, descricaoEvento (110111=Cancelamento etc.), dataEvento |
| 8.9 | Parse `procEventoNFe` (evento completo) | ✅ | Mapeamento completo |
| 8.10 | `FiltrosDfe` — filtros client-side pós-SEFAZ | ✅ | modelo, cnpjEmitente, situacao, dataInicio/Fim, valorMin/Max, schemas |
| 8.11 | Cooldown local 1h por CNPJ+ambiente após cStat 137 | ✅ | Map de módulo compartilhado; bloqueia request antes de bater no SEFAZ |
| 8.12 | cStat 656 (rate limit SEFAZ) — tratamento com mensagem clara | ✅ | Lançado antes de tentar decodificar resposta |
| 8.13 | `consultarCnpj` via BrasilAPI | ✅ | Testado com CNPJ `61156864000191` (AFR Fernandes) — retornou razaoSocial, CNAE, Simples |
| 8.14 | Decode gzip+base64 dos docZip | ✅ | inflateSync + UTF-8 |

**Rate limit SEFAZ Nacional:**
- `<distNSU>` (paginação): cStat 137 → bloqueio de 1h por CNPJ
- `<consNSU>` e `<consChNFe>`: sem rate limit específico documentado
- Proteção local: `distNsuCooldowns` Map no módulo — compartilhado entre instâncias do mesmo processo

**Arquivos:**
- `src/providers/NfeDistribuicaoProvider.ts` — todos os métodos + `consultarCnpj` + `importarNfeXml`
- `src/sefaz/CteConstants.ts` — `NFE_DISTRIBUICAO_ENDPOINT` (hom1 + www1)

**Pendências:**
- Validar `consultarDFe` produção quando rate limit expirar (~1h após última chamada)
- Validar `consultarPorNsu` e `consultarPorChave` com NSU/chave reais
- Validar parse de `resEvento` e `procEventoNFe` com documentos reais da SEFAZ

---

## Próximos passos recomendados (prioridade)

1. **NF-e Distribuição DFe produção** — aguardar expirar rate limit (~1h) e revalidar `consultarDFe` com CNPJ `61156864000191`; validar `consultarPorNsu` e `consultarPorChave`
2. **NFC-e** — obter CSC homologação (portal SEFAZ MG, RS ou PR) e rodar `make test:nfce`
3. **CT-e** — obter RNTRC e série CT-e de uma transportadora para testar emissão e cancelamento
4. **NFS-e ABRASF** — validar contra prefeitura real com servidor de IP autorizado
5. **NFS-e Nota RP** — aguardar migração de Ribeirão Preto para v3
6. **SAT** — depende de hardware físico; validar por último ou em ambiente de cliente
7. **NF-e produção** — habilitar após validação completa em homologação
