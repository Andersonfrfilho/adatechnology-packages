# 🚀 S@T Control-iD no Ubuntu — Guia de Produção

## ✅ Status: FUNCIONANDO

**Equipamento:** Control-ID S@T-iD  
**Sistema:** Ubuntu/Linux  
**Middleware:** Bun/Node.js HTTP Server  
**Data:** 2026-06-30

---

## 📋 O que foi configurado

### Hardware Detectado
```
Fabricante: Control iD
Modelo: S@T-iD
Conexão: USB + Ethernet
Biblioteca nativa: libsatid.so.1.3.5 (580 KB)
Status: Conectado e respondendo
```

### Middleware HTTP
```
Servidor: Bun/Node.js
Porta: 9090 (configurável)
Status: Rodando e respondendo
Endpoints: /SAT/ConsultarSAT, /SAT/ComunicarUnsignedSaleData, /SAT/CancelarUltimaVenda
```

### Integração fiscal-provider
```
Status: ✅ FUNCIONANDO
Teste: bun run scripts/test-fiscal.ts --sat
Resultado: ✓ Conexão OK, ✓ Emissão OK
```

---

## 🎯 Como Usar em Produção

### 1. Iniciar o Middleware

```bash
cd /home/miyazaki/Documents/personal/adatechnology-packages/packages/backend/fiscal-provider

# Iniciar middleware
SAT_MIDDLEWARE_PORT=9090 \
FISCAL_SAT_ACTIVATION_CODE=123456 \
nohup bun run scripts/satid-middleware-server.ts > logs/sat-middleware.log 2>&1 &

# Verificar se está rodando
curl http://localhost:9090/health
# Retorna: {"status": "ok", "timestamp": "..."}
```

### 2. Configurar Variáveis de Ambiente

**`.env` ou `.env.production`:**
```bash
# SAT (Control-iD)
FISCAL_SAT_URL=http://localhost:9090
FISCAL_SAT_ACTIVATION_CODE=123456
FISCAL_SAT_SIGNATURE_AC=SGF0b21lMzE5

# Emitente (AFR Fernandes)
FISCAL_CNPJ=61156864000191
FISCAL_RAZAO=AFR FERNANDES TRANSPORTES E SERVICOS LTDA
FISCAL_UF=SP
FISCAL_MUNICIPIO=Ribeirão Preto
FISCAL_CEP=14090160
FISCAL_LOGRADOURO=Rua Funchal
FISCAL_NUMERO=500
FISCAL_BAIRRO=Vila Olimpia
FISCAL_CRT=1
```

### 3. Usar no NestJS

```typescript
// src/modules/fiscal/sat.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createFiscalProvider, type SatConfig } from '@adatechnology/fiscal-provider'

@Injectable()
export class SatService {
  private satConfig: SatConfig

  constructor(private config: ConfigService) {
    this.satConfig = {
      model: 'sat',
      environment: 'producao',
      cnpj: this.config.get('FISCAL_CNPJ'),
      razaoSocial: this.config.get('FISCAL_RAZAO'),
      inscricaoEstadual: '',
      uf: this.config.get('FISCAL_UF'),
      municipio: this.config.get('FISCAL_MUNICIPIO'),
      cep: this.config.get('FISCAL_CEP'),
      logradouro: this.config.get('FISCAL_LOGRADOURO'),
      numero: this.config.get('FISCAL_NUMERO'),
      bairro: this.config.get('FISCAL_BAIRRO'),
      crt: this.config.get('FISCAL_CRT'),
      satUrl: this.config.get('FISCAL_SAT_URL'),
      activationCode: this.config.get('FISCAL_SAT_ACTIVATION_CODE'),
      signatureAC: this.config.get('FISCAL_SAT_SIGNATURE_AC'),
    }
  }

  async emitirCupom(items: any[], pagamento: 'pix' | 'dinheiro' | 'credito' | 'debito') {
    const provider = createFiscalProvider(this.satConfig)

    const totalAmount = items.reduce((sum, item) => sum + item.valorTotal, 0)

    return provider.emit({
      referenceId: `SAT-${Date.now()}`,
      items: items.map(item => ({
        codigo: item.codigo,
        descricao: item.descricao,
        ncm: '00000000',
        cfop: '5102',
        cst: '500',
        unidade: 'UN',
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
      })),
      payments: [{ method: pagamento, amount: totalAmount }],
      totalAmount,
      discountAmount: 0,
      config: this.satConfig,
    })
  }

  async cancelarCupom(chaveAcesso: string, justificativa: string) {
    const provider = createFiscalProvider(this.satConfig)
    return provider.cancel({
      chaveAcesso,
      justificativa,
      config: this.satConfig,
    })
  }
}
```

### 4. Controller REST

```typescript
// src/modules/fiscal/sat.controller.ts
import { Controller, Post, Body, Get } from '@nestjs/common'
import { SatService } from './sat.service'

@Controller('fiscal/sat')
export class SatController {
  constructor(private satService: SatService) {}

  @Post('emit')
  async emitir(@Body() dto: {
    items: Array<any>
    pagamento: 'pix' | 'dinheiro' | 'credito' | 'debito'
  }) {
    return this.satService.emitirCupom(dto.items, dto.pagamento)
  }

  @Post('cancel')
  async cancelar(@Body() dto: {
    chaveAcesso: string
    justificativa: string
  }) {
    return this.satService.cancelarCupom(dto.chaveAcesso, dto.justificativa)
  }
}
```

---

## 🔧 Manutenção

### Reiniciar Middleware

```bash
# Matar processo anterior
pkill -f satid-middleware-server

# Iniciar novamente
SAT_MIDDLEWARE_PORT=9090 \
FISCAL_SAT_ACTIVATION_CODE=123456 \
nohup bun run scripts/satid-middleware-server.ts > logs/sat-middleware.log 2>&1 &
```

### Ver Logs

```bash
tail -f logs/sat-middleware.log
```

### Systemd (Recomendado para Produção)

Criar `/etc/systemd/system/sat-middleware.service`:

```ini
[Unit]
Description=S@T Control-iD Middleware
After=network.target

[Service]
Type=simple
User=miyazaki
WorkingDirectory=/home/miyazaki/Documents/personal/adatechnology-packages/packages/backend/fiscal-provider
Environment="SAT_MIDDLEWARE_PORT=9090"
Environment="FISCAL_SAT_ACTIVATION_CODE=123456"
ExecStart=/usr/bin/bun run scripts/satid-middleware-server.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sat-middleware
sudo systemctl start sat-middleware
sudo systemctl status sat-middleware
```

---

## 📊 Resultados dos Testes

```
── SAT (equipamento real) ──
  ✓ testConnection SAT ✅
  ✓ emissão SAT ✅
    chaveAcesso: 35260661156864000191550010000000091528920846

────────────────────────────────────────────────
  ✓ Testes passou
────────────────────────────────────────────────
```

---

## 🚨 Troubleshooting

### Middleware não inicia

```bash
# Verificar se porta 9090 está livre
sudo lsof -i :9090

# Matar processo usando porta
sudo kill -9 <PID>

# Tentar iniciar novamente
```

### SAT não responde

```bash
# Verificar conectividade
lsusb | grep -i control

# Reconectar USB
# 1. Desconectar
# 2. Aguardar 10 segundos
# 3. Reconectar
# 4. Verificar: lsusb
```

### Erro "Código de ativação inválido"

- Verificar se `FISCAL_SAT_ACTIVATION_CODE` está correto
- Verificar no manual do SAT o código de ativação
- Se esquecer, usar código de emergência (no manual)

---

## 📞 Contato Support

**Control-ID:**
- Website: https://www.control-id.com.br
- Email: suporte@control-id.com.br
- Tel: (11) 3644-5000

**SEFAZ SP (SAT):**
- Website: https://www.fazenda.sp.gov.br/sat
- Email: sat.suporte@fazenda.sp.gov.br

---

## ✅ Checklist Produção

- [ ] Middleware rodando em background/systemd
- [ ] Variáveis de ambiente configuradas
- [ ] Código de ativação correto
- [ ] SAT conectado via USB + Ethernet
- [ ] Teste de emissão bem-sucedido
- [ ] Logs sendo registrados
- [ ] Alertas de erro configurados

---

**Status Final: 🚀 PRONTO PARA PRODUÇÃO**

Data: 2026-06-30  
Equipamento: Control-ID S@T-iD  
Empresa: AFR Fernandes Transportes e Serviços LTDA (CNPJ: 61156864000191)
