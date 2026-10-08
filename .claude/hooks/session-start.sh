#!/bin/bash
# Prepara las sesiones de Claude Code en la nube: instala las dependencias para
# que los tipos, los tests y las pruebas de pantalla funcionen desde el primer
# momento. En el ordenador propio no hace nada.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# `npm install` (y no `npm ci`) aprovecha lo que ya quedó instalado en el
# contenedor de una sesión anterior. El navegador de las pruebas de pantalla ya
# viene en el entorno de la nube: no se descarga.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
