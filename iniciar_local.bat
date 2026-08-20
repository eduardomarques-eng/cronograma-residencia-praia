@echo off
title Servidor Local - Cronograma ArqVertice
echo ========================================================
echo   INICIANDO SERVIDOR LOCAL DO CRONOGRAMA ARQVERTICE
echo ========================================================
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0iniciar_servidor_local.ps1"
pause
