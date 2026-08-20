# ============================================================================
# Servidor local do Cronograma ArqVertice
# PowerShell puro: nao exige Node.js, Python nem qualquer instalacao.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\servidor-local.ps1
# ============================================================================
param(
  [int]$Port = 8123,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# A pasta servida e a raiz do projeto (pasta acima de \scripts).
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "index.html"))) {
  Write-Host "ERRO: index.html nao encontrado em $Root" -ForegroundColor Red
  exit 1
}

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".pdf"  = "application/pdf"
  ".ico"  = "image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "ERRO: nao foi possivel abrir a porta $Port. Ela pode estar em uso." -ForegroundColor Red
  Write-Host "Tente outra porta: .\scripts\servidor-local.ps1 -Port 8200" -ForegroundColor Yellow
  exit 1
}

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Cronograma ArqVertice rodando em $url" -ForegroundColor Green
Write-Host "  Pasta servida: $Root"
Write-Host "  Pressione Ctrl+C para encerrar."
Write-Host ""

if (-not $NoBrowser) { Start-Process $url }

$rootFull = (Resolve-Path $Root).Path

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

    $full = Join-Path $Root $rel
    $servir = $null

    if (Test-Path $full -PathType Leaf) {
      $fileFull = (Resolve-Path $full).Path
      # Impede que um caminho com .. escape da pasta do projeto.
      if ($fileFull.StartsWith($rootFull)) { $servir = $fileFull }
    }

    if ($servir) {
      $bytes = [System.IO.File]::ReadAllBytes($servir)
      $ext = [System.IO.Path]::GetExtension($servir).ToLower()
      $type = $mime[$ext]
      if (-not $type) { $type = "application/octet-stream" }

      $ctx.Response.ContentType = $type
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.StatusCode = 200
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - arquivo nao encontrado: $rel")
      $ctx.Response.StatusCode = 404
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }

    $ctx.Response.OutputStream.Close()
  } catch {
    Write-Host "Falha ao atender requisicao: $_" -ForegroundColor DarkYellow
  }
}
