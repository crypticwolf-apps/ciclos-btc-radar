@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo No encuentro Node.js/npm. Instala Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm.cmd install
  if errorlevel 1 goto error
)

echo Arrancando Ciclos BTC...
echo.
echo Cuando aparezca la direccion local, abre http://127.0.0.1:5173/
echo Para parar la app, cierra esta ventana o pulsa Ctrl+C.
echo.

call npm.cmd run dev -- --host 127.0.0.1
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo No se pudo iniciar la app.
pause
exit /b 1
