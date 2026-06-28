# Credenciamento NFC-e — SEFAZ SP

Empresa: **AFR FERNANDES TRANSPORTES E SERVICOS LTDA**
CNPJ: `61156864000191`
Certificado: `certificado-12345678-2025-6-nov.pfx`
Senha: `12345678`

---

## 1. Instalar o certificado no macOS

```bash
security import ~/Desktop/certificado-12345678-2025-6-nov.pfx \
  -k ~/Library/Keychains/login.keychain-db \
  -P 12345678 \
  -T /Applications/Google\ Chrome.app \
  -T /Applications/Safari.app
```

Verificar se instalou:

```bash
security find-certificate -c "AFR FERNANDES" ~/Library/Keychains/login.keychain-db
```

Esperado na saída: `labl"AFR FERNANDES TRANSPORTES E SERVICOS LTDA"`

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
3. O macOS vai exibir um alerta pedindo a **senha de login do computador** (não é a senha `12345678` do certificado) — digitar a senha do usuário macOS e clicar em **Permitir**
4. O Chrome vai perguntar qual certificado usar — selecionar **AFR FERNANDES TRANSPORTES**
5. Navegar até: `NFC-e → Credenciamento → Solicitar Credenciamento`

Preencher:

| Campo | Valor |
|---|---|
| Modelo | 65 (NFC-e) |
| Ambiente | Homologação e Produção |
| Série | 001 |
| CNPJ | 61156864000191 |

---

## 4. Testar integração após aprovação

```bash
cd packages/fiscal-provider

export SEFAZ_CERT_BASE64=$(base64 -i ~/Desktop/certificado-12345678-2025-6-nov.pfx | tr -d '\n')
export SEFAZ_CERT_SENHA=12345678
export SEFAZ_CNPJ=61156864000191
export SEFAZ_UF=SP
export SEFAZ_CODIGO_MUNICIPIO=3543402

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
CERT_B64=$(base64 -i ~/Desktop/certificado-12345678-2025-6-nov.pfx | tr -d '\n')

cat >> apps/api/.env <<EOF
SEFAZ_CERT_BASE64=${CERT_B64}
SEFAZ_CERT_SENHA=12345678
SEFAZ_UF=SP
SEFAZ_CODIGO_MUNICIPIO=3543402
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
