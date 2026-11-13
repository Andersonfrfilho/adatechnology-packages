# 🔧 Guia de Diagnóstico — S@T no Ubuntu

## 1️⃣ Verificar Conexão USB

```bash
# Listar todos os dispositivos USB
lsusb

# Procurar pelo SAT (varia por fabricante)
lsusb | grep -iE '0679|0765|daruma|gertec|elgin|sweda'

# Ver IDs de fabricante conhecidos:
# Daruma: 0679:0001
# Gertec: 0765:5001
# Elgin: (varia)
```

### Se não aparecer:
1. Desconectar e reconectar o cabo USB
2. Tentar porta USB diferente (traseira é melhor que frontal)
3. Tentar conectar diretamente (não usar hub)
4. Reiniciar o computador
5. Verificar se o SAT está ligado (LED indicador aceso)

---

## 2️⃣ Verificar Detectores do Kernel

```bash
# Ver logs do sistema (se tiver permissão)
sudo dmesg | tail -50 | grep -i usb

# Ou verificar arquivo de log
sudo tail -50 /var/log/syslog | grep -i usb
```

---

## 3️⃣ Verificar Drivers

```bash
# Alguns S@T precisam de drivers específicos

# Para Daruma:
sudo apt-cache search daruma
# Instalar se necessário:
sudo apt-get install daruma-middleware

# Para Gertec:
sudo apt-cache search gertec
# Instalar se necessário:
sudo apt-get install gertec-middleware
```

---

## 4️⃣ Encontrar Porta Serial/USB do SAT

```bash
# Ver dispositivos de série
ls -la /dev/ttyUSB*
ls -la /dev/ttyACM*
ls -la /dev/hidraw*

# Ou procurar por ID do vendor
# Exemplo: se SAT é ID 0679:0001
grep -r "0679" /sys/devices/
```

---

## 5️⃣ Instalar Middleware SAT

### Daruma (mais comum)

```bash
# Download
wget https://www.daruma.com.br/suporte/downloads/DarumaMiddleware-SAT-Linux.deb

# Instalar
sudo dpkg -i DarumaMiddleware-SAT-Linux.deb

# Iniciar serviço
sudo systemctl start daruma-middleware
sudo systemctl enable daruma-middleware

# Verificar status
sudo systemctl status daruma-middleware

# Ver logs
sudo journalctl -u daruma-middleware -f
```

### Gertec

```bash
wget https://www.gertec.com.br/downloads/GertecSAT-Middleware-Linux.tar.gz
tar -xzf GertecSAT-Middleware-Linux.tar.gz
cd GertecSAT-Middleware
sudo ./install.sh
sudo systemctl start gertec-sat
sudo systemctl status gertec-sat
```

### Elgin

```bash
wget https://www.elgin.com.br/suporte/sat/ElginSAT-Middleware-Linux.tar.gz
tar -xzf ElginSAT-Middleware-Linux.tar.gz
cd ElginSAT-Middleware
sudo ./install.sh
```

---

## 6️⃣ Verificar Middleware Rodando

```bash
# Ver portas TCP abertas (middleware geralmente porta 8080)
netstat -tlnp | grep 8080
# ou
ss -tlnp | grep 8080

# Tentar conectar ao middleware
curl -X POST http://localhost:8080/sat/SAT/ConsultarSAT \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "numeroSessao=000001&codigoDeAtivacao=123456"
```

---

## 7️⃣ Checklist de Diagnóstico

- [ ] SAT está ligado (LED aceso)?
- [ ] Cabo USB conectado diretamente (sem hub)?
- [ ] `lsusb` mostra o dispositivo?
- [ ] Drivers instalados para o fabricante?
- [ ] Middleware instalado e rodando?
- [ ] Porta 8080 (ou outra) acessível?
- [ ] `curl` consegue conectar ao middleware?
- [ ] Código de Ativação correto?

---

## 📞 Suporte por Fabricante

**Daruma:**
- https://www.daruma.com.br/suporte
- Tel: (11) 3611-1500

**Gertec:**
- https://www.gertec.com.br
- Tel: (11) 4062-7700

**Elgin:**
- https://www.elgin.com.br/suporte
- Tel: (11) 4741-5800

**SEFAZ SP (S@T):**
- https://www.fazenda.sp.gov.br/sat
- Email: sat.suporte@fazenda.sp.gov.br
