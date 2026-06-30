# 🔌 Setup S@T Control-ID no Ubuntu

## ✅ Status Detectado

- **Fabricante:** Control iD
- **Modelo:** S@T-iD
- **Conexão:** USB (CDC ACM)
- **Bus:** 001
- **Device:** 042
- **Driver:** cdc_acm

---

## 1️⃣ Reconectar o Cabo USB

**Por favor, siga estes passos:**

1. Desconecte o cabo USB do S@T Control-ID
2. Aguarde 5 segundos
3. Reconecte o cabo
4. Aguarde 10 segundos para o sistema detectar

Depois, rode:
```bash
ls -la /dev/ttyACM*
```

Deve aparecer algo como `/dev/ttyACM0`

---

## 2️⃣ Baixar o Middleware Control-ID

O middleware não está nos repositórios padrão do Ubuntu. Você precisa:

**Opção A: Site oficial Control-ID**
- Acesse: https://www.control-id.com.br/suporte
- Procure por: "SAT-iD Middleware Linux"
- Download: `ControlID-SAT-Middleware-Linux-x64.tar.gz` (ou similar)

**Opção B: Contactar suporte**
- Email: suporte@control-id.com.br
- Tel: (11) 3644-5000

---

## 3️⃣ Instalar o Middleware

```bash
# Extrair o arquivo baixado
tar -xzf ControlID-SAT-Middleware-*.tar.gz
cd ControlID-SAT-Middleware

# Dar permissão de execução
chmod +x install.sh

# Instalar (pode precisar sudo)
sudo ./install.sh

# Iniciar o serviço
sudo systemctl start control-id-sat
# ou
sudo service control-id-sat start
```

---

## 4️⃣ Verificar Middleware Rodando

```bash
# Verificar se está rodando
sudo systemctl status control-id-sat

# Ver logs
sudo journalctl -u control-id-sat -f
# ou
sudo tail -f /var/log/control-id-sat.log

# Verificar porta (geralmente 8080 ou 9000)
netstat -tlnp | grep -E '8080|9000'
ss -tlnp | grep -E '8080|9000'
```

---

## 5️⃣ Encontrar o Código de Ativação

O código de ativação vem com o equipamento. Procure em:

1. **Etiqueta no equipamento** - código de 6 dígitos
2. **Manual/Documentação** fornecida
3. **Aplicativo Control-ID** - se tiver instalado no Windows
4. **Portal Control-ID** - sua conta no site deles

---

## 6️⃣ Configurar as Variáveis de Ambiente

```bash
cd /home/miyazaki/Documents/personal/adatechnology-packages/packages/backend/fiscal-provider

# Editar o .env.local
nano .env.local

# Alterar:
FISCAL_SAT_URL=http://localhost:8080/sat
# ou
FISCAL_SAT_URL=http://localhost:9000/sat

# E preencher:
FISCAL_SAT_ACTIVATION_CODE=123456  # seu código aqui
FISCAL_SAT_SIGNATURE_AC=XXXXX      # do equipamento
```

---

## 7️⃣ Testar a Conexão

```bash
# Carregar as variáveis
source .env.local

# Testar o SAT
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

## 🔧 Troubleshooting

### Porta serial não aparece
```bash
# Recarregar driver
sudo modprobe -r cdc_acm
sudo modprobe cdc_acm

# Ou reiniciar o sistema
sudo reboot
```

### Middleware não inicia
```bash
# Verificar permissões
sudo chmod +x /opt/control-id-sat/bin/*

# Ver erro específico
sudo systemctl start control-id-sat
sudo journalctl -u control-id-sat -n 50
```

### Timeout ao conectar
```bash
# Verificar se middleware está ouvindo
curl -v http://localhost:8080/
# ou
curl -v http://localhost:9000/
```

### SAT não responde
```bash
# Verificar se o equipamento está ligado
lsusb | grep -i control

# Tentar reconectar o USB
# Desconectar, aguardar 10s, reconectar
```

---

## 📞 Contatos Control-ID

- **Site:** https://www.control-id.com.br
- **Suporte:** suporte@control-id.com.br
- **Telefone:** (11) 3644-5000
- **Portal:** https://portal.control-id.com.br

---

## 📋 Checklist

- [ ] Cabo USB reconectado
- [ ] `/dev/ttyACM0` aparece em `ls -la /dev/ttyACM*`
- [ ] Middleware Control-ID baixado
- [ ] Middleware instalado com sucesso
- [ ] Middleware rodando (`systemctl status`)
- [ ] Código de Ativação obtido
- [ ] `.env.local` configurado
- [ ] `test-fiscal.ts --sat` retorna sucesso
- [ ] Primeira NFS-e emitida via S@T

