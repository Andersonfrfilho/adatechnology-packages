#!/bin/bash
# Script para instalar e executar o SAT Activation Software

set -e

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║          Instalador: Software de Ativação SAT Control-ID                  ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Configurações
INSTALLER_FILE="$HOME/Downloads/satid-setup-x86_64.run"
INSTALL_DIR="$HOME/SAT_Ativador"

# Passo 1: Verificar arquivo
echo "📦 Passo 1: Verificar arquivo instalador"
echo ""

if [ ! -f "$INSTALLER_FILE" ]; then
  echo "❌ Erro: Arquivo não encontrado"
  echo "   Esperado: $INSTALLER_FILE"
  echo ""
  echo "💡 Baixe em: https://www.control-id.com.br/downloads"
  exit 1
fi

FILE_SIZE=$(du -h "$INSTALLER_FILE" | cut -f1)
echo "✅ Arquivo encontrado"
echo "   Caminho: $INSTALLER_FILE"
echo "   Tamanho: $FILE_SIZE"
echo ""

# Passo 2: Tornar executável
echo "🔐 Passo 2: Definir permissões"
echo ""

chmod +x "$INSTALLER_FILE"
echo "✅ Permissões atualizadas (chmod +x)"
echo ""

# Passo 3: Verificar dependências
echo "🛠️  Passo 3: Verificar dependências"
echo ""

# Verificar se há dependências necessárias
DEPS_OK=true

if ! command -v lsb_release &> /dev/null; then
  echo "⚠️  lsb_release não encontrado (não crítico)"
  DEPS_OK=false
fi

if ! command -v uname &> /dev/null; then
  echo "❌ Erro: uname não encontrado"
  exit 1
fi

OS_NAME=$(uname -s)
ARCH=$(uname -m)

echo "✅ SO: $OS_NAME"
echo "✅ Arquitetura: $ARCH"
echo ""

if [ "$ARCH" != "x86_64" ]; then
  echo "⚠️  Aviso: Arquitetura pode não ser compatível"
  echo "   Seu sistema: $ARCH"
  echo "   Esperado: x86_64"
  echo ""
  read -p "Continuar mesmo assim? (s/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
  fi
fi

# Passo 4: Verificar S@T-iD
echo "🔍 Passo 4: Detectar S@T-iD via USB"
echo ""

if command -v lsusb &> /dev/null; then
  if lsusb | grep -i "control\|sat"; then
    echo "✅ S@T-iD DETECTADO!"
  else
    echo "⚠️  S@T-iD não detectado via USB"
    echo "   Verifique:"
    echo "   • Cabo USB conectado?"
    echo "   • S@T-iD ligado?"
    echo "   • Drivers instalados?"
    echo ""
    read -p "Continuar mesmo assim? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
      exit 1
    fi
  fi
else
  echo "⚠️  lsusb não disponível, pulando detecção"
fi

echo ""

# Passo 5: Criar diretório de instalação
echo "📁 Passo 5: Preparar diretório"
echo ""

if [ ! -d "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
  echo "✅ Diretório criado: $INSTALL_DIR"
else
  echo "✅ Diretório já existe: $INSTALL_DIR"
fi

echo ""

# Passo 6: Executar instalador
echo "🚀 Passo 6: Executar instalador"
echo ""
echo "⏳ Aguarde... O instalador será aberto"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Executar o instalador
"$INSTALLER_FILE" --prefix="$INSTALL_DIR"

EXIT_CODE=$?

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ INSTALAÇÃO CONCLUÍDA!"
  echo ""
  echo "Próximos passos:"
  echo "  1. Abra o Software Ativador:"
  echo "     $INSTALL_DIR/satid-activator --gui"
  echo ""
  echo "  2. Conecte o S@T-iD (USB + Ethernet)"
  echo ""
  echo "  3. Clique em 'Ativar Equipamento'"
  echo ""
  echo "  4. Digite um código de 8-32 caracteres"
  echo ""
  echo "  5. Quando a ativação for bem-sucedida, use:"
  echo "     bun run controlid:setup-code"
  echo ""
  echo "  6. Cole o código obtido"
  echo ""
else
  echo "❌ ERRO NA INSTALAÇÃO (código: $EXIT_CODE)"
  echo ""
  echo "Tente:"
  echo "  • Executar com sudo:"
  echo "    sudo $INSTALLER_FILE --prefix=/opt/SAT_Ativador"
  echo ""
  echo "  • Ou manualmente:"
  echo "    cd $INSTALL_DIR"
  echo "    ./satid-activator --gui"
  echo ""
  exit $EXIT_CODE
fi

echo ""
echo "📖 Documentação:"
echo "   cat CONTROLID_ATIVACAO_GUIA.md"
echo ""
