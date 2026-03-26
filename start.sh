#!/bin/bash
echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Técnicas Textiles · Taller         ║"
echo "╚══════════════════════════════════════╝"
echo ""
# Check node
if ! command -v node &>/dev/null; then
  echo "❌  Node.js no encontrado. Instálalo desde https://nodejs.org"
  exit 1
fi
# Install deps if needed
if [ ! -d node_modules ]; then
  echo "📦  Instalando dependencias..."
  npm install
fi
echo "🚀  Iniciando servidor..."
echo "   → Abre en tu navegador: http://localhost:3000"
echo "   → Ctrl+C para detener"
echo ""
node server.js
