# 🔐 Guia de Ativação: Obtendo o Código SAT

## Passo 1: Preparação do Equipamento

### Verificar Conexão
```bash
# No seu PC com Ubuntu, verifique se o S@T-iD está detectado
lsusb | grep -i control

# Resultado esperado:
# Bus 001, Device 051: ID Control iD S@T-iD
```

### Verificar Internet
```bash
# O S@T-iD precisa estar conectado à rede (Ethernet)
# Verificar ping para SEFAZ
ping www.fazenda.sp.gov.br

# Ou conecte o S@T via Ethernet a um switch/roteador
```

---

## Passo 2: Baixar Software Ativador

### No Site da Control-ID
1. Acesse: https://www.control-id.com.br
2. Faça login com dados da sua empresa
3. Navegue para: **Produtos → S@T-iD → Downloads**
4. Baixe: **"Software Ativador SAT v1.3.6"** (ou versão mais recente)
5. Baixe também: **"Drivers USB"**

### Para Linux/Ubuntu
```bash
# Se baixou em ~/Downloads
cd ~/Downloads

# Extrair
unzip Software_Ativador_SAT_Linux.zip

# Verificar permissão
ls -la SAT_Ativador/

# Tornar executável
chmod +x SAT_Ativador/satid-activator
```

---

## Passo 3: Obter o Código de Ativação

### Opção A: Software Ativador (Recomendado)

```bash
# Abrir o Software Ativador
cd ~/Downloads/SAT_Ativador
./satid-activator --gui

# Ou em modo terminal
./satid-activator --activate \
  --device /dev/ttyACM0 \
  --activation-code "SUA_NOVA_SENHA"
```

**Interface do Software:**
1. Conecte o S@T-iD
2. Clique em "Ativar Equipamento"
3. Será solicitado: **"Novo Código de Ativação"**
4. Digite uma senha de **8-32 caracteres** (ex: `MeuSAT2024#Seguro`)
5. Confirme a senha
6. Aguarde a ativação (conectará com SEFAZ)
7. **ANOTE O CÓDIGO** em local seguro

### Opção B: Código de Emergência (Se S@T Bloqueado)

Se o equipamento foi usado antes e está bloqueado:

1. Procure a **etiqueta física do equipamento** (traseira/lateral)
2. Busque: **"Código de Desbloqueio"** ou **"Emergency Code"**
3. Formato: geralmente 8 dígitos numéricos
4. Use esse código para resetar e definir um novo

**Exemplo:**
```
┌──────────────────────────┐
│ S@T-iD Control           │
│ Serial: SAT-123456       │
│ Emergency: 12345678      │ ← Este código
└──────────────────────────┘
```

---

## Passo 4: Validar o Código

### Testar com cURL
```bash
# Depois de obter o código, teste:
curl -X POST http://localhost:9090/SAT/ConsultarSAT \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "numeroSessao=000001&codigoDeAtivacao=MeuSAT2024#Seguro"

# Resposta esperada:
# {
#   "codigoDeRetorno": "08000",
#   "mensagemRetorno": "Equipamento respondeu"
# }
```

### Validar no Middleware
```bash
# Iniciar middleware com o código real
FISCAL_SAT_ACTIVATION_CODE="MeuSAT2024#Seguro" \
SAT_MIDDLEWARE_PORT=9090 \
bun run controlid:middleware

# Ver logs
tail -f logs/sat-middleware.log

# Esperar por: "Activation successful" ou similar
```

---

## Passo 5: Armazenar de Forma Segura

### ✅ Criar `.env.controlid` (LOCAL)

```bash
# Apenas no seu computador (NÃO commitar ao git)
cd packages/backend/fiscal-provider

cat > .env.controlid << 'EOF'
# SAT Activation Code
FISCAL_SAT_ACTIVATION_CODE=MeuSAT2024#Seguro
FISCAL_SAT_SIGNATURE_AC=SGF0b21lMzE5

# Middleware
SAT_MIDDLEWARE_PORT=9090
FISCAL_SAT_URL=http://localhost:9090

# Company
FISCAL_CNPJ=61156864000191
FISCAL_RAZAO=AFR FERNANDES TRANSPORTES E SERVICOS LTDA
FISCAL_UF=SP
FISCAL_MUNICIPIO=Ribeirão Preto
EOF

# Proteger arquivo
chmod 600 .env.controlid
```

### ✅ Guardar em Cofre de Senhas

1. **1Password, Bitwarden, KeePass, etc.**
2. Armazene:
   - Código de Ativação
   - Código de Emergência
   - Número Serial do S@T
   - Data de Ativação
   - Email de suporte Control-ID

### ❌ NUNCA faça isso:

```bash
# ❌ NÃO commitar ao git
git add .env.controlid
git commit -m "add activation code"

# ❌ NÃO deixar em .env.local compartilhado
# ❌ NÃO registrar em logs
# ❌ NÃO enviar por email/Slack
```

---

## Passo 6: Usar o Código em Produção

### Ambiente Local (Desenvolvimento)

```bash
# Carregar variáveis
source .env.controlid

# Iniciar middleware
bun run controlid:middleware

# Emitir cupom de teste
bun run scripts/exemplo-cupom-sat.ts
```

### Ambiente Docker/Produção

```bash
# Passar como variável de ambiente (seguro)
docker run -e FISCAL_SAT_ACTIVATION_CODE="$FISCAL_SAT_ACTIVATION_CODE" \
  -e FISCAL_SAT_URL="http://sat-device:9090" \
  minha-app:latest
```

### NestJS

```typescript
// src/app.module.ts
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.controlid',
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

---

## Troubleshooting

### "Activation code not valid"

```bash
# 1. Verificar variável
echo $FISCAL_SAT_ACTIVATION_CODE

# 2. Verificar .env.controlid
cat .env.controlid | grep FISCAL_SAT_ACTIVATION

# 3. Testar com emergência code
FISCAL_SAT_ACTIVATION_CODE="12345678" \
bun run controlid:middleware
```

### "Device not found"

```bash
# 1. Verificar USB
lsusb | grep -i control

# 2. Se não aparecer, reconectar
# Desconectar → Aguardar 10s → Reconectar

# 3. Verificar permissões
ls -la /dev/ttyACM0
# Se não conseguir acessar, adicionar ao grupo:
sudo usermod -a -G dialout $USER
# Fazer logout/login para aplicar
```

### "SEFAZ not responding"

```bash
# 1. Verificar internet do S@T-iD
ping 200.156.91.135  # SEFAZ SP

# 2. Verificar Ethernet conectado
# 3. Tentar reativar pelo Software Ativador
```

---

## Checklist Final

```
Equipamento
  ☐ S@T-iD conectado via USB
  ☐ S@T-iD conectado via Ethernet (ou WiFi)
  ☐ Três LEDs acesos
  ☐ lsusb mostra "Control iD S@T-iD"

Ativação
  ☐ Software Ativador baixado e instalado
  ☐ Código de Ativação definido (8-32 caracteres)
  ☐ Código de Emergência anotado (etiqueta)
  ☐ Código armazenado em cofre seguro

Configuração
  ☐ .env.controlid criado (chmod 600)
  ☐ Adicionado a .gitignore
  ☐ Middleware inicia sem erros
  ☐ curl /health retorna 200 OK

Teste
  ☐ Middleware detecta S@T
  ☐ ConsultarSAT retorna sucesso
  ☐ Código funciona em produção
  ☐ Logs registram operações
```

---

## 📞 Suporte

- **Control-ID:** (11) 3644-5000 | suporte@control-id.com.br
- **SEFAZ SP:** sat.suporte@fazenda.sp.gov.br
- **Seu Contador:** pode recuperar dados de ativação anterior

---

**Próximo passo:** Depois de obter o código, execute:
```bash
source .env.controlid
bun run controlid:test
```
