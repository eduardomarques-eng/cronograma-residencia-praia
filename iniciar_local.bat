@echo off
title Servidor Local - Cronograma ArqVertice
echo ========================================================
echo   INICIANDO SERVIDOR LOCAL DO CRONOGRAMA ARQVERTICE
echo ========================================================
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\servidor-local.ps1"
pause
