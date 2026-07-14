@echo off
cd /d "%~dp0\..\backend"

if not exist "..\node_modules\.bin\tsc.cmd" (
  echo ERROR: Ejecute "npm install" en la raiz del proyecto primero.
  exit /b 1
)

if not exist "dist\index.js" (
  echo Compilando backend...
  call ..\node_modules\.bin\tsc.cmd -p tsconfig.json
  if errorlevel 1 exit /b 1
)

echo Whispper API en http://localhost:4000
node dist\index.js
