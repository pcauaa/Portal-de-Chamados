# ============================================================================
# Backup diario do Portal de Chamados
#
# Faz dump do banco (pg_dump em formato custom, o unico que suporta restore
# seletivo e paralelo) e um zip da pasta de anexos, com retencao de 30 dias.
#
# Nao inventa credenciais: le a DATABASE_URL do .env do proprio projeto, a
# mesma que a aplicacao usa - um unico lugar define a conexao.
# ============================================================================

$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$BackupDir  = Join-Path $ProjectDir 'backups'
$PgBinDir   = 'C:\Program Files\PostgreSQL\16\bin'
$RetentionDays = 30

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile   = Join-Path $BackupDir 'backup.log'

function Write-Log($message) {
    $line = "[$(Get-Date -Format o)] $message"
    Write-Output $line
    Add-Content -Path $LogFile -Value $line
}

function Read-DatabaseUrl {
    $envPath = Join-Path $ProjectDir '.env'
    if (-not (Test-Path $envPath)) {
        throw "Arquivo .env nao encontrado em $envPath"
    }
    $line = Get-Content $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if (-not $line) { throw "DATABASE_URL nao encontrada no .env" }

    # postgresql://usuario:senha@host:porta/banco?schema=public
    if ($line -notmatch 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?"]+)') {
        throw "Nao foi possivel interpretar a DATABASE_URL"
    }
    return @{
        User     = $Matches[1]
        Password = $Matches[2]
        Host     = $Matches[3]
        Port     = $Matches[4]
        Database = $Matches[5]
    }
}

try {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

    Write-Log "=== Iniciando backup $Timestamp ==="

    $conn = Read-DatabaseUrl
    $env:PGPASSWORD = $conn.Password

    # --- Banco: pg_dump em formato custom (-Fc), comprimido e restauravel com pg_restore ---
    $dbBackupFile = Join-Path $BackupDir "chamados-$Timestamp.backup"
    $pgDump = Join-Path $PgBinDir 'pg_dump.exe'

    & $pgDump -h $conn.Host -p $conn.Port -U $conn.User -d $conn.Database -Fc -f $dbBackupFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou com codigo $LASTEXITCODE" }

    $dbSize = (Get-Item $dbBackupFile).Length
    if ($dbSize -eq 0) { throw "Arquivo de backup do banco ficou vazio" }
    Write-Log "Banco: $dbBackupFile ($([math]::Round($dbSize/1KB,1)) KB)"

    # --- Anexos: zip da pasta storage/, se ela existir e tiver conteudo ---
    $storageDir = Join-Path $ProjectDir 'storage'
    if ((Test-Path $storageDir) -and (Get-ChildItem $storageDir -Recurse -File -ErrorAction SilentlyContinue)) {
        $storageZip = Join-Path $BackupDir "storage-$Timestamp.zip"
        Compress-Archive -Path "$storageDir\*" -DestinationPath $storageZip -Force
        Write-Log "Anexos: $storageZip ($([math]::Round((Get-Item $storageZip).Length/1KB,1)) KB)"
    } else {
        Write-Log "Anexos: pasta storage/ vazia ou inexistente, pulando"
    }

    # --- Retencao: remove backups mais antigos que $RetentionDays ---
    $limite = (Get-Date).AddDays(-$RetentionDays)
    $antigos = Get-ChildItem $BackupDir -Include 'chamados-*.backup','storage-*.zip' -Recurse |
        Where-Object { $_.LastWriteTime -lt $limite }
    foreach ($f in $antigos) {
        Remove-Item $f.FullName -Force
        Write-Log "Removido por retencao ($RetentionDays dias): $($f.Name)"
    }

    Write-Log "=== Backup concluido com sucesso ==="
}
catch {
    Write-Log "ERRO: $_"
    throw
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
