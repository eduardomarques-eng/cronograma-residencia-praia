# =============================================================================
# Preparacao do ARQVERTICE FLOW na Vercel.
#
# Faz, por ordem: liga ao projecto, descarrega as variaveis, aplica as 14
# migrations e cria o utilizador ADMIN.
#
# PrÃ©-requisitos (UMA VEZ):
#   1. npm i -g vercel
#   2. vercel login          <-- interactivo, tem de ser feito no navegador
#   3. Defina na Vercel (Settings > Environment Variables, Production):
#        DATABASE_URL          (obrigatorio)
#        AUTH_SECRET           (obrigatorio)
#        ADMIN_KEY             (obrigatorio)
#        NEXT_PUBLIC_APP_URL   (obrigatorio)
#        SEED_ADMIN_EMAIL      (obrigatorio para criar a conta)
#        SEED_ADMIN_PASSWORD   (obrigatorio para criar a conta)
#        SEED_ADMIN_NAME       (opcional)
#
# Uso:  powershell -ExecutionPolicy Bypass -File .\scripts\preparar-vercel.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Passo([string]$mensagem) { Write-Host "" ; Write-Host "==> $mensagem" -ForegroundColor Cyan }

Write-Host "ARQVertice - preparacao Vercel" -ForegroundColor Green
Write-Host "Raiz: $raiz"

# --- 0. Autenticacao ---------------------------------------------------------
Passo "Verificando autenticacao"
& vercel.cmd whoami 2>&1 | ForEach-Object { Write-Host "  $_" }

# --- 1. Ligar ao projecto ----------------------------------------------------
Passo "Ligando ao projecto (escolha o ja existente quando perguntar)"
& vercel.cmd link --yes 2>&1 | ForEach-Object { Write-Host "  $_" }

if (-not (Test-Path ".vercel\project.json")) {
    Write-Host ""
    Write-Host "Nao foi possivel ligar ao projecto." -ForegroundColor Red
    Write-Host "Crie/importe primeiro o projecto em vercel.com e volte a executar." -ForegroundColor Yellow
    exit 1
}

# --- 2. Descarregar variaveis ------------------------------------------------
Passo "Descarregando variaveis de ambiente"
& vercel.cmd env pull .env.local --environment=production --yes 2>&1 | ForEach-Object { Write-Host "  $_" }

if (-not (Test-Path ".env.local")) {
    Write-Host "Nao foi possivel descarregar o .env.local" -ForegroundColor Red
    exit 1
}

# Confirma que a ligacao a base de dados veio.
$temDb = Select-String -Path ".env.local" -Pattern '^DATABASE_URL=' -Quiet
if (-not $temDb) {
    Write-Host ""
    Write-Host "DATABASE_URL nao existe nas variaveis da Vercel." -ForegroundColor Red
    Write-Host "Defina-a e volte a executar. Sem ela a aplicacao nao tem dados." -ForegroundColor Yellow
    exit 1
}

# --- 3. Migrations -----------------------------------------------------------
Passo "Gerando Prisma Client"
& npx.cmd prisma generate 2>&1 | ForEach-Object { Write-Host "  $_" }

Passo "Aplicando as migrations"
& npx.cmd prisma migrate deploy 2>&1 | ForEach-Object { Write-Host "  $_" }

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "As migrations FALHARAM. A base de dados continua sem tabelas." -ForegroundColor Red
    exit 1
}

Passo "Estado das migrations"
& npx.cmd prisma migrate status 2>&1 | ForEach-Object { Write-Host "  $_" }

# --- 4. Seed -----------------------------------------------------------------
Passo "Criando o utilizador ADMIN"
& npm.cmd run db:seed 2>&1 | ForEach-Object { Write-Host "  $_" }

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "CONCLUIDO" -ForegroundColor Green
    Write-Host "Va a /login na aplicacao e entre com as credenciais de ADMIN." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "O seed falhou. Confirme SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD na Vercel." -ForegroundColor Yellow
    exit 1
}

