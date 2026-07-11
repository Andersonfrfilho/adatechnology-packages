# @adatechnology/fiscal-provider

Emissão de **documentos fiscais brasileiros** direto na SEFAZ/prefeitura, **sem intermediários**.
TypeScript, roda em Node e Bun.

- **NFC-e** (modelo 65) — venda ao consumidor
- **NF-e** (modelo 55) — B2B / interestadual
- **NFS-e** (ABRASF 2.04) — serviços
- **CT-e** (modelo 57) — transporte
- **SAT** (CF-e) — São Paulo (equipamento)

Inclui: assinatura digital A1 (RSA-SHA1 XML-DSig), **grupo IBS/CBS da Reforma Tributária (NT 2025.002)**,
QR Code NFC-e, DANFE/DANFCE em PDF, cancelamento, verificação de QR Code e orientações de erro (`errorHint`).

---

## Instalação

```bash
npm i @adatechnology/fiscal-provider
# ou: pnpm add / bun add
```

Dependências nativas já inclusas (`node-forge`, `xml-crypto`, `fast-xml-parser`, `pdfkit`, `qrcode`).

---

## Uso básico

```ts
import { createFiscalProvider, type NfceConfig } from '@adatechnology/fiscal-provider'

const config: NfceConfig = {
  model: 'nfce',
  environment: 'producao',          // 'homologacao' para testes
  cnpj: '61156864000191',
  inscricaoEstadual: '154336693112',
  razaoSocial: 'Minha Empresa LTDA',
  uf: 'SP',
  municipio: 'RIBEIRAO PRETO',
  codigoMunicipio: '3543402',        // IBGE 7 dígitos
  cep: '14076400',
  logradouro: 'Av Mogiana',
  numero: '2296',
  bairro: 'Independencia',
  crt: '1',                          // 1=Simples 2=Simples excesso 3=Normal
  certificadoBase64: '<base64 do .pfx>',
  certificadoSenha: '<senha>',
  serie: '1',
  numeroNf: 1,
  cscId: '1',                        // do credenciamento SEFAZ
  cscToken: '<token CSC>',
}

const provider = createFiscalProvider(config)

// Emitir
const result = await provider.emit({
  referenceId: 'PEDIDO-001',
  config,
  totalAmount: 100.0,
  discountAmount: 0,
  items: [{
    codigo: '001', descricao: 'Produto', ncm: '21069090', cfop: '5102',
    cst: '102',                      // Simples → CSOSN; Normal → CST
    unidade: 'UN', quantidade: 1, valorUnitario: 100.0, valorTotal: 100.0,
  }],
  payments: [{ method: 'pix', amount: 100.0 }],
})

if (result.success) {
  console.log(result.chaveAcesso, result.protocolo)
  console.log(result.qrCodeUrl)      // NFC-e
  console.log(result.xmlAutorizado)  // nfeProc (NFC-e e NF-e)
  console.log(result.cupomPdf?.base64) // DANFCE em PDF (base64)
} else {
  console.log(result.errorCode, result.errorMessage)
  console.log(result.errorHint)      // orientação acionável, ex: "[Ambiente: PRODUCAO] ..."
}
```

### Cancelar

```ts
// NFC-e / NF-e — protocolo obrigatório; janela legal (NFC-e SP ~30 min)
await provider.cancel({
  chaveAcesso: '44 dígitos',
  protocolo: 'nProt da autorização',
  justificativa: 'Erro na emissão do documento fiscal',  // mín. 15 caracteres
  config,
})
```

O cancelamento usa a **hora da SEFAZ** (não o relógio local) e re-tenta automaticamente em
rejeições de data (cStat 577/578) — robusto contra clock skew de servidores/containers.

### Testar conexão

```ts
const status = await provider.testConnection({ config })  // { ok, message }
```

---

## Reforma Tributária (IBS/CBS)

A partir de 2026 a SEFAZ exige o grupo **IBS/CBS** por item (NT 2025.002) — a lib gera
automaticamente (CST 000, alíquotas de transição). Para sobrescrever:

```ts
const config: NfceConfig = {
  // ...
  ibsCbs: { cst: '000', classTrib: '000001', pIbsUf: 0.1, pIbsMun: 0.0, pCbs: 0.9 },
}
```

---

## Outros modelos (resumo)

```ts
import { type NfeConfig, type NfseConfig, type SatConfig } from '@adatechnology/fiscal-provider'

// NF-e (55): precisa de nfeData.destinatario + naturezaOperacao no emit()
// NFS-e (ABRASF): NfseConfig com webserviceUrl, inscricaoMunicipal, codigoServico, aliquotaIss
// SAT (SP): SatConfig com satUrl (middleware local), activationCode, signatureAC
```

---

## Utilitários exportados

| Função | Uso |
|---|---|
| `createFiscalProvider(config)` | fábrica do provider por `config.model` |
| `verifyQrCode({ qrCodeUrl, cscToken })` | valida estrutura + dígito verificador + hash/CSC do QR |
| `buildCupomPdf(...)` / `buildDanfce(...)` | DANFCE (PDF / ASCII) |
| `validateCertificate(base64, senha)` | valida o A1 (CNPJ, validade, ICP-Brasil) |
| `consultarCnpj(cnpj)` | dados públicos do CNPJ (BrasilAPI/ReceitaWS) |
| `importarNfeXml(xml)` | parse de NF-e/NFC-e recebida |
| `resolveErrorHint(cStat, ambiente)` | orientação em pt-BR para o cStat |
| `isChaveDvValid(chave)` | valida dígito verificador (mód. 11) da chave |

---

## Pré-requisitos por modelo

- **NFC-e/NF-e:** certificado e-CNPJ A1 válido + credenciamento na SEFAZ do estado (homologação e produção são **separados**). NFC-e exige **CSC** (Id + Token) do credenciamento.
- **NFS-e:** URL do webservice + inscrição municipal do município.
- **SAT:** equipamento + middleware HTTP local.

---

## Erros comuns (cStat)

| cStat | Causa | Ação |
|---|---|---|
| 245 | CNPJ não credenciado | credenciar no PFE (homolog/prod separados) |
| 462/464 | CSC (Id não cadastrado / hash difere) | usar o par cscId+cscToken correto do ambiente |
| 209 | IE inválida | conferir IE no cadastro estadual |
| 1115 | IBS/CBS ausente | atualizar a lib (grupo obrigatório em 2026) |
| 577/578 | data do evento (cancel) | tratado automaticamente (retry + hora SEFAZ) |

O campo `result.errorHint` já traz a orientação pronta para exibir ao usuário.

---

## Licença

MIT © Ada Technology
