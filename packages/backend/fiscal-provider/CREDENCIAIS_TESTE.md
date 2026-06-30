# Credenciais para Testes de Integração — fiscal-provider

Preencha as seções dos modelos que você quer testar e rode o comando correspondente.

---

## Como gerar o base64 do certificado .pfx

```bash
base64 -i /caminho/para/certificado.pfx | pbcopy
# agora é só colar nas variáveis abaixo
```

---

## Emitente (comum a NFC-e, NF-e e NFS-e)

```env
FISCAL_CNPJ=
FISCAL_IE=
FISCAL_RAZAO=
FISCAL_UF=
FISCAL_MUNICIPIO=
FISCAL_CEP=
FISCAL_LOGRADOURO=
FISCAL_NUMERO=
FISCAL_BAIRRO=
```

---

## Certificado A1 (NFC-e, NF-e e NFS-e)

```env
FISCAL_CERT_BASE64=
FISCAL_CERT_SENHA=
```

---

## NFC-e — SEFAZ direto

Obtido no portal SEFAZ do seu estado (homologação).

```env
FISCAL_SERIE=1
FISCAL_NUMERO_NF=1
FISCAL_CODIGO_MUNICIPIO=
FISCAL_CSC_ID=
FISCAL_CSC_TOKEN=
```

> **Atenção `serie`:** Use `1`, não `001`. O schema SEFAZ PL009 rejeita zeros à esquerda (cStat 225).

Comando:
```bash
FISCAL_CNPJ=... FISCAL_IE=... FISCAL_RAZAO=... FISCAL_UF=SP \
FISCAL_MUNICIPIO=... FISCAL_CEP=... FISCAL_LOGRADOURO=... \
FISCAL_NUMERO=... FISCAL_BAIRRO=... \
FISCAL_CERT_BASE64=... FISCAL_CERT_SENHA=... \
FISCAL_CSC_TOKEN=... FISCAL_CSC_ID=... \
FISCAL_CODIGO_MUNICIPIO=... \
bun run test:nfce
```

---

## NF-e — SEFAZ direto (modelo 55)

Suporta destinatário pessoa jurídica (CNPJ) ou física (CPF).

```env
FISCAL_SERIE=1
FISCAL_NUMERO_NF=1
FISCAL_CODIGO_MUNICIPIO=

# Destinatário PJ (CNPJ):
FISCAL_NFE_DEST_CNPJ=
FISCAL_NFE_DEST_NOME=

# OU destinatário PF (CPF) — editar test-fiscal.ts para usar campo cpf

FISCAL_NFE_DEST_CEP=
FISCAL_NFE_DEST_LOGRADOURO=
FISCAL_NFE_DEST_NUMERO=
FISCAL_NFE_DEST_BAIRRO=
FISCAL_NFE_DEST_MUNICIPIO=
FISCAL_NFE_DEST_UF=
FISCAL_NFE_DEST_COD_MUN=
```

> **Homologação:** O `xNome` do destinatário é substituído automaticamente para
> `'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'` pelo builder (cStat 598 caso contrário).
> Em produção o nome real é preservado.

> **IE do emitente:** O CNPJ precisa estar cadastrado como contribuinte ICMS no SEFAZ do estado.
> Informe os dígitos limpos sem pontos/traços (ex: `110042490114`).
> Simples Nacional sem IE, deixe `FISCAL_IE=` vazio → gera `<IE>ISENTO</IE>`.

Comando:
```bash
FISCAL_CNPJ=... FISCAL_IE=... FISCAL_RAZAO=... FISCAL_UF=... \
FISCAL_MUNICIPIO=... FISCAL_CEP=... FISCAL_LOGRADOURO=... \
FISCAL_NUMERO=... FISCAL_BAIRRO=... \
FISCAL_CERT_BASE64=... FISCAL_CERT_SENHA=... \
FISCAL_CODIGO_MUNICIPIO=... \
FISCAL_NFE_DEST_CNPJ=... FISCAL_NFE_DEST_NOME=... \
FISCAL_NFE_DEST_CEP=... FISCAL_NFE_DEST_LOGRADOURO=... \
FISCAL_NFE_DEST_NUMERO=... FISCAL_NFE_DEST_BAIRRO=... \
FISCAL_NFE_DEST_MUNICIPIO=... FISCAL_NFE_DEST_UF=... \
FISCAL_NFE_DEST_COD_MUN=... \
bun run test:nfe
```

---

## NFS-e — ABRASF direto (serviços municipais)

A URL do webservice varia por município — consulte o portal ISS do município.

```env
FISCAL_NFSE_URL=
FISCAL_INSCRICAO_MUNICIPAL=
FISCAL_CODIGO_MUNICIPIO=
FISCAL_CODIGO_SERVICO=
FISCAL_ALIQUOTA_ISS=
```

Comando:
```bash
FISCAL_CNPJ=... FISCAL_CERT_BASE64=... FISCAL_CERT_SENHA=... \
FISCAL_NFSE_URL=... FISCAL_INSCRICAO_MUNICIPAL=... \
FISCAL_CODIGO_MUNICIPIO=... FISCAL_CODIGO_SERVICO=... \
FISCAL_ALIQUOTA_ISS=5.00 \
bun run test:nfse
```

---

## NFS-e substituição (SubstituirNfse)

Precisa de uma NFS-e já emitida em homologação para substituir.

```env
FISCAL_NFSE_NUMERO_ORIGINAL=
```

Comando:
```bash
# mesmas vars do NFS-e, mais:
FISCAL_NFSE_NUMERO_ORIGINAL=... \
bun run test:nfse-sub
```

---

## SAT — São Paulo (equipamento físico)

Requer o middleware SAT rodando localmente e o equipamento ligado.

```env
FISCAL_SAT_URL=
FISCAL_SAT_ACTIVATION_CODE=
FISCAL_SAT_SIGNATURE_AC=
```

Comando:
```bash
FISCAL_CNPJ=... \
FISCAL_SAT_URL=... \
FISCAL_SAT_ACTIVATION_CODE=... \
FISCAL_SAT_SIGNATURE_AC=... \
bun run test:sat
```

---

## Rodar tudo de uma vez

```bash
FISCAL_CNPJ=... \
FISCAL_CERT_BASE64=... \
FISCAL_CERT_SENHA=... \
# ... todas as variáveis acima ...
bun run test:all
```

---

## Referências rápidas — Código IBGE dos municípios

| Município          | Código IBGE |
|--------------------|-------------|
| São Paulo — SP     | 3550308     |
| Ribeirão Preto — SP| 3543402     |
| Belo Horizonte     | 3106200     |
| Rio de Janeiro     | 3304557     |
| Curitiba           | 4106902     |
| Porto Alegre       | 4314902     |
| Campinas           | 3509502     |
| Guarulhos          | 3518800     |
| Florianópolis      | 4205407     |

Para outros: https://www.ibge.gov.br/explica/codigos-dos-municipios.php

---

## Códigos cStat SEFAZ mais comuns

| cStat | Significado | Causa provável |
|-------|-------------|----------------|
| 100   | Autorizado o uso da NF-e | Sucesso |
| 150   | Autorizado fora do prazo | Sucesso (contingência) |
| 209   | IE do emitente inválida | CNPJ não cadastrado no SEFAZ estadual ou IE errada |
| 225   | Falha no Schema XML | Campo fora do padrão (ex: serie com zeros, vDesc ausente) |
| 502   | Erro na Chave de Acesso | Campo Id não bate com a concatenação dos dados (verificar mod 55/65) |
| 598   | xNome destinatário errado (homologação) | Deve ser a string fixa do SEFAZ — builder resolve automaticamente |
| 656   | Consumo indevido | xmlns ausente no enviNFe |
