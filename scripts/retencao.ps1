# ============================================================================
# Retencao diaria do Portal de Chamados
#
# Remove anexos, comentarios e historico de chamados ENCERRADOS ha mais de 90
# dias. O registro do chamado em si (numero, titulo, categoria, datas,
# closingNote) e preservado - so o conteudo "pesado" e removido.
#
# Roda depois do backup (02:00) de proposito: se este script errar, o backup
# daquela noite ja foi feito antes.
# ============================================================================

$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$LogDir     = Join-Path $ProjectDir 'logs'
$LogFile    = Join-Path $LogDir 'retencao.log'
$Node       = 'C:\Program Files\nodejs\node.exe'
$TsxBin     = Join-Path $ProjectDir 'node_modules\tsx\dist\cli.mjs'
$Script     = Join-Path $ProjectDir 'scripts\retencao.ts'
$Shim       = Join-Path $ProjectDir 'scripts\server-only-shim.cjs'

function Write-Log($message) {
    $line = "[$(Get-Date -Format o)] $message"
    Write-Output $line
    Add-Content -Path $LogFile -Value $line
}

try {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    Write-Log "=== Iniciando retencao ==="

    Push-Location $ProjectDir
    # Barras normais de proposito: NODE_OPTIONS com caminho em barra invertida
    # dentro de aspas escapadas perde os separadores ao ser repassado ao
    # processo filho (reproduzido e confirmado neste projeto). Windows aceita
    # barra normal em caminho de arquivo sem ressalva.
    $ShimForward = $Shim -replace '\\', '/'
    $env:NODE_OPTIONS = "--require $ShimForward"

    # A saida do script (console.log) vai direto para o log tambem.
    $output = & $Node $TsxBin $Script 2>&1
    $output | ForEach-Object { Add-Content -Path $LogFile -Value $_ }
    $output | ForEach-Object { Write-Output $_ }

    if ($LASTEXITCODE -ne 0) {
        throw "retencao.ts saiu com codigo $LASTEXITCODE"
    }

    Write-Log "=== Retencao concluida ==="
}
catch {
    Write-Log "ERRO: $_"
    throw
}
finally {
    Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
    Pop-Location
}
