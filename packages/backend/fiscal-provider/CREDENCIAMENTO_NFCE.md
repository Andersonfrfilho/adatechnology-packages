# Credenciamento NFC-e — SEFAZ SP

---

## 1. Instalar o certificado no macOS

```bash
security import /caminho/para/certificado.pfx \
  -k ~/Library/Keychains/login.keychain-db \
  -P <SENHA_CERTIFICADO> \
  -T /Applications/Google\ Chrome.app \
  -T /Applications/Safari.app
```

Verificar se instalou:

```bash
security find-certificate -c "RAZAO SOCIAL DA EMPRESA" ~/Library/Keychains/login.keychain-db
```

---

## 2. Reabrir o Chrome

```bash
osascript -e 'quit app "Google Chrome"'
open -a "Google Chrome"
```

---

## 3. Acessar o portal de credenciamento NFC-e (PFE)

> ⚠️ O portal correto é o **Posto Fiscal Eletrônico (PFE)**, não o NFP (Nota Fiscal Paulista).
> O NFP é o programa de pontuação para consumidores — não serve para credenciar emissores.

1. Abrir `https://www3.fazenda.sp.gov.br/PFE`
2. Clicar em **Acesso via certificado digital**
3. O macOS vai exibir um alerta pedindo a **senha de login do computador** (não é a senha do certificado) — digitar a senha do usuário macOS e clicar em **Permitir**
4. O Chrome vai perguntar qual certificado usar — selecionar o certificado da empresa
5. Navegar até: `NFC-e → Credenciamento → Solicitar Credenciamento`

Preencher:

| Campo | Valor |
|---|---|
| Modelo | 65 (NFC-e) |
| Ambiente | Homologação e Produção |
| Série | 001 |
| CNPJ | `<CNPJ_DA_EMPRESA>` |

---

## ⚠️ Diagnóstico: O que causa HTTP 404 nos testes

Durante os testes de homologação, endpoints SP NFC-e podem retornar **HTTP 404** mesmo com certificado apresentado no handshake TLS. As causas mais comuns:

### Causa 1 — Certificado com uso restrito (`VideoConferencia`)

Alguns certificados e-CNPJ A1 são emitidos com:

```
OU = VideoConferencia
```

Esse OU indica um e-CNPJ para uso em **videoconferência gov**, não para emissão de documentos fiscais. O SEFAZ aceita o TLS (cert válido ICP-Brasil), mas rejeita na camada de aplicação porque o perfil do certificado não corresponde a um certificado NF-e/NFC-e padrão.

**Para NFC-e é necessário um e-CNPJ A1 de uso geral (sem OU VideoConferencia).** Esses certificados são emitidos por ACs como Certisign, Serpro, Valid, Safeweb — comprando o plano "e-CNPJ A1 — Nota Fiscal Eletrônica" ou equivalente.

### Causa 2 — Credenciamento CNPJ não realizado

SP exige que o CNPJ do emitente seja credenciado antes de aceitar requisições NFC-e. Sem credenciamento:

- Sem cert → HTTP 403 (exige mTLS)
- **Com cert → HTTP 404** (cert aceito no TLS, CNPJ não cadastrado)
- Com cert + credenciado → SOAP response normal

### Caminhos SP NFC-e (confirmados)

Os endpoints SP usam `/ws/` (não `/nfceweb/services/` como em documentações antigas):

```
Homologação:  https://homologacao.nfce.fazenda.sp.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx
Produção:     https://nfce.fazenda.sp.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx
```

---

## 4. Testar integração após aprovação

```bash
cd packages/fiscal-provider

export SEFAZ_CERT_BASE64=$(base64 -i /caminho/para/certificado.pfx | tr -d '\n')
export SEFAZ_CERT_SENHA=<SENHA_CERTIFICADO>
export SEFAZ_CNPJ=<CNPJ_DA_EMPRESA>
export SEFAZ_UF=SP
export SEFAZ_CODIGO_MUNICIPIO=<CODIGO_IBGE_7_DIGITOS>

bun run test:sefaz
```

Resultado esperado após credenciamento:

```
✅  SEFAZ está operacional: Serviço em Operação
✅  NFC-e AUTORIZADA
✅  Chave: 35...44 dígitos
✅  Protocolo: 135...
```

---

## 5. Configurar o .env da API

```bash
# Converter certificado para base64 e gravar no .env
CERT_B64=$(base64 -i /caminho/para/certificado.pfx | tr -d '\n')

cat >> apps/api/.env <<EOF
SEFAZ_CERT_BASE64=${CERT_B64}
SEFAZ_CERT_SENHA=<SENHA_CERTIFICADO>
SEFAZ_UF=SP
SEFAZ_CODIGO_MUNICIPIO=<CODIGO_IBGE_7_DIGITOS>
SEFAZ_SERIE=001
SEFAZ_ENVIRONMENT=homologacao
EOF
```

---

## Observações

- O credenciamento em SP costuma ser aprovado em até **24h** úteis
- Homologação e produção precisam ser credenciados **separadamente**
- Após credenciar homologação, testar com `bun run test:sefaz` antes de ir para produção
- Para ir a produção: alterar `SEFAZ_ENVIRONMENT=producao` no `.env`
