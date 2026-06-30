# 🏢 Setup AFR Fernandes — NFS-e + S@T

## 📋 Status da Configuração

- ✅ Certificado A1 convertido para base64
- ✅ Arquivo `.env.local` criado
- ⏳ **Aguardando:** Senha do certificado PFX

---

## 1️⃣ Credenciais da Empresa

```
Razão Social: AFR FERNANDES TRANSPORTES E SERVICOS LTDA
CNPJ:        61156864000191
Município:   Ribeirão Preto (SP)
IBGE:        3543402
IM:          20935293
UF:          SP

Certificado: e-CNPJ A1
Válido até:  05/11/2026 13:34
```

---

## 2️⃣ Completar Configuração

### Passo 1: Fornecer Senha do Certificado

Edite o arquivo `.env.local` e substitua `MUDE_PARA_SENHA_DO_CERTIFICADO`:

```bash
cd /home/miyazaki/Documents/personal/adatechnology-packages/packages/backend/fiscal-provider

# Editar com seu editor favorito
nano .env.local

# Ou via sed (substitua a senha abaixo):
sed -i 's/MUDE_PARA_SENHA_DO_CERTIFICADO/COLOQUE_AQUI_A_SENHA/g' .env.local
```

### Passo 2: Validar Certificado

```bash
source .env.local
bun run scripts/validate-cert.ts
```

**Saída esperada:**
```
🔍 Validando certificado A1...

✅ Certificado carregado com sucesso!

📋 Dados do certificado:
───────────────────────
  Tipo: e-CNPJ A1
  PEM length: 1704 chars
  Key length: 3272 chars
  Status: ✅ Válido
```

---

## 3️⃣ Testar NFS-e (ISS Net Online)

### Teste de Conexão

```bash
source .env.local
bun run scripts/test-fiscal.ts --nfse
```

**Saída esperada:**
```
── NFS-e direta ABRASF ──
  ✓ webservice municipal acessível
  ✓ emissão NFS-e
    número NFS-e: 12345
  ✓ cancelamento NFS-e
```

### Se Falhar: Troubleshooting

| Erro | Solução |
|------|---------|
| `HTTP 404` | IP não autorizado pela prefeitura RP. Contatar prefeitura. |
| `Certificado inválido` | Verificar se a senha está correta e o certificado é válido. |
| `timeout` | ISS Net Online pode estar em manutenção. Tentar novamente. |

---

## 4️⃣ Testar S@T (Opcional)

Se você tiver um equipamento SAT conectado:

### Passo 1: Instalar Middleware

```bash
# Daruma
sudo dpkg -i DarumaMiddleware-SAT.deb
sudo systemctl start daruma-middleware
sudo systemctl enable daruma-middleware

# Verificar status
sudo systemctl status daruma-middleware
```

### Passo 2: Verificar Conexão USB

```bash
lsusb | grep -iE 'daruma|gertec|elgin'
```

### Passo 3: Testar SAT

```bash
source .env.local
bun run scripts/test-fiscal.ts --sat
```

**Saída esperada:**
```
── SAT (equipamento real) ──
  ✓ testConnection SAT
  ✓ emissão SAT
    chaveAcesso: 35260661156864000191550010000000091528920846
```

---

## 5️⃣ Integração NestJS

### Instalação do Pacote

```bash
cd /path/to/seu-projeto-nestjs

# Se estiver usando o monorepo:
pnpm add @adatechnology/fiscal-provider
```

### Configurar Variáveis de Ambiente (produção)

Copie as variáveis para seu arquivo `.env`:

```env
FISCAL_CNPJ=61156864000191
FISCAL_CERT_BASE64=MIIP2gIBAzCCD5Q...
FISCAL_CERT_SENHA=sua_senha_aqui
FISCAL_NFSE_URL=https://ribeiraopreto.issnetonline.com.br/ISS/apirecepcaoservico.asmx
FISCAL_INSCRICAO_MUNICIPAL=20935293
FISCAL_CODIGO_MUNICIPIO=3543402
FISCAL_CODIGO_SERVICO=0105
FISCAL_ALIQUOTA_ISS=2.00
FISCAL_SAT_URL=http://localhost:8080/sat
FISCAL_SAT_ACTIVATION_CODE=123456
FISCAL_SAT_SIGNATURE_AC=sua_signature_aqui
```

### Criar Módulo Fiscal

```typescript
// src/modules/fiscal/fiscal.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NfseService } from './nfse.service';
import { SatService } from './sat.service';
import { FiscalController } from './fiscal.controller';

@Module({
  imports: [ConfigModule],
  providers: [NfseService, SatService],
  controllers: [FiscalController],
  exports: [NfseService, SatService],
})
export class FiscalModule {}
```

### Criar Serviço NFS-e

```typescript
// src/modules/fiscal/nfse.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  createFiscalProvider, 
  type NfseConfig, 
  type EmitFiscalParams,
} from '@adatechnology/fiscal-provider';

@Injectable()
export class NfseService {
  private nfseConfig: NfseConfig;

  constructor(private config: ConfigService) {
    this.nfseConfig = {
      model: 'nfse',
      environment: this.config.get('FISCAL_ENV') || 'homologacao',
      cnpj: this.config.get('FISCAL_CNPJ'),
      razaoSocial: 'AFR FERNANDES TRANSPORTES E SERVICOS LTDA',
      inscricaoEstadual: '',
      uf: 'SP',
      municipio: 'Ribeirão Preto',
      cep: '14090160',
      logradouro: 'Rua Funchal',
      numero: '500',
      bairro: 'Vila Olimpia',
      crt: '1',
      certificadoBase64: this.config.get('FISCAL_CERT_BASE64'),
      certificadoSenha: this.config.get('FISCAL_CERT_SENHA'),
      webserviceUrl: this.config.get('FISCAL_NFSE_URL'),
      inscricaoMunicipal: this.config.get('FISCAL_INSCRICAO_MUNICIPAL'),
      codigoMunicipio: this.config.get('FISCAL_CODIGO_MUNICIPIO'),
      codigoServico: this.config.get('FISCAL_CODIGO_SERVICO'),
      aliquotaIss: parseFloat(this.config.get('FISCAL_ALIQUOTA_ISS')),
      issRetido: false,
    };
  }

  async emitir(discriminacao: string, valor: number) {
    const provider = createFiscalProvider(this.nfseConfig);
    
    const params: EmitFiscalParams = {
      referenceId: `NFSE-${Date.now()}`,
      items: [{
        codigo: '001',
        descricao: 'Serviço',
        ncm: '00000000',
        cfop: '5101',
        cst: '400',
        unidade: 'UN',
        quantidade: 1,
        valorUnitario: valor,
        valorTotal: valor,
      }],
      payments: [{ method: 'pix', amount: valor }],
      totalAmount: valor,
      discountAmount: 0,
      nfseData: {
        discriminacao,
        competencia: new Date().toISOString().slice(0, 7),
      },
      config: this.nfseConfig,
    };

    return provider.emit(params);
  }
}
```

---

## 6️⃣ Endpoints REST Disponíveis

### NFS-e

```bash
# Testar conexão
GET /fiscal/nfse/test-connection

# Emitir serviço
POST /fiscal/nfse/emit
{
  "descricao": "Serviço de transporte",
  "discriminacao": "Frete de São Paulo para Ribeirão Preto",
  "valorTotal": 500.00,
  "dataCompetencia": "2025-06"
}

# Cancelar
POST /fiscal/nfse/cancel
{
  "numeroNfse": "123456",
  "justificativa": "Cancelamento por erro operacional"
}
```

### S@T (se aplicável)

```bash
# Testar conexão
GET /fiscal/sat/test-connection

# Emitir cupom
POST /fiscal/sat/emit
{
  "itens": [
    {
      "codigo": "001",
      "descricao": "Combustível",
      "quantidade": 50,
      "valorUnitario": 6.50
    }
  ],
  "formaPagamento": "dinheiro"
}

# Cancelar
POST /fiscal/sat/cancel
{
  "chaveAcesso": "35260661156864000191550010000000091528920846",
  "justificativa": "Cancelamento imediato por erro"
}
```

---

## 7️⃣ Checklist Final

- [ ] Certificado validado (`bun run scripts/validate-cert.ts`)
- [ ] NFS-e testado (`bun run scripts/test-fiscal.ts --nfse`)
- [ ] S@T testado (se aplicável) (`bun run scripts/test-fiscal.ts --sat`)
- [ ] Variáveis de ambiente configuradas em produção
- [ ] Módulo FiscalModule registrado no app.module.ts
- [ ] Endpoints REST testados via cURL ou Postman
- [ ] Primeira NFS-e emitida com sucesso
- [ ] Documentação compartilhada com o time

---

## 📞 Suporte

**ISS Net Online Ribeirão Preto:**
- Portal: https://ribeiraopreto.issnetonline.com.br
- Suporte: (16) 3636-8000
- Email: suporte@issnetonline.com.br

**SEFAZ SP (S@T):**
- Portal: https://www.fazenda.sp.gov.br/sat
- Documentação: https://www.fazenda.sp.gov.br/sat/DocumentoArquivos/Especificacao_Tecnica_do_SAT.pdf

---

**Próximo passo:** Forneça a senha do certificado para completar a configuração! 🚀
