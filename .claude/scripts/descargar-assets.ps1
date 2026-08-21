<#
.SYNOPSIS
    Sincroniza fotos/ y videos/ de la carpeta de Drive de un cliente hacia
    clientes/<nombre>/assets/{fotos,videos}, sin duplicar archivos ya descargados.

.DESCRIPTION
    Este script asume una instalación estándar de Claude Code con el conector
    google_workspace_mcp registrado vía CLI (`claude mcp add gworkspace -- uvx workspace-mcp`)
    y usa la API REST v3 de Google Drive directamente con un access token OAuth.

    NOTA — entorno de esta sesión: en esta sesión de trabajo, Google Drive está disponible
    como conector de la plataforma (herramientas MCP invocadas por Claude directamente:
    list_recent_files / search_files / download_file_content), no como una instalación CLI
    local de Claude Code. En ese modo, la sincronización la ejecuta el propio agente llamando
    a esas herramientas con la MISMA lógica que implementa este script (ver más abajo), sin
    pasar por PowerShell. Este script queda documentado y listo para una instalación CLI
    standalone, donde sí puede ejecutarse tal cual.

.PARAMETER Cliente
    Nombre de la carpeta del cliente en clientes/<nombre>/ (debe existir).

.PARAMETER DriveFolderId
    ID de la carpeta de Drive del cliente (se toma de perfil.md si no se especifica).

.EXAMPLE
    ./descargar-assets.ps1 -Cliente cafe-lunar -DriveFolderId 1AbCdEfGhIjKlmNoPQRstuv
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Cliente,

    [string]$DriveFolderId
)

$ErrorActionPreference = "Stop"

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$clienteDir = Join-Path $agenciaRoot "clientes\$Cliente"
$perfilPath = Join-Path $clienteDir "perfil.md"
$fotosDir = Join-Path $clienteDir "assets\fotos"
$videosDir = Join-Path $clienteDir "assets\videos"

if (-not (Test-Path $clienteDir)) {
    throw "No existe clientes/$Cliente/. Ejecutá primero /nuevo-cliente $Cliente."
}

New-Item -ItemType Directory -Force -Path $fotosDir, $videosDir | Out-Null

if (-not $DriveFolderId) {
    if (-not (Test-Path $perfilPath)) {
        throw "No se especificó -DriveFolderId y no existe perfil.md para leerlo."
    }
    $urlLine = Select-String -Path $perfilPath -Pattern "drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)" | Select-Object -First 1
    if (-not $urlLine) {
        throw "No se encontró una URL de carpeta de Drive en perfil.md. Pasá -DriveFolderId explícitamente."
    }
    $DriveFolderId = $urlLine.Matches[0].Groups[1].Value
}

$accessToken = $env:GOOGLE_ACCESS_TOKEN
if (-not $accessToken) {
    throw "Falta la variable de entorno GOOGLE_ACCESS_TOKEN (token OAuth de la cuenta de Drive de la agencia)."
}

$headers = @{ Authorization = "Bearer $accessToken" }

function Get-DriveSubfolderId {
    param([string]$ParentId, [string]$Name)
    $q = "'$ParentId' in parents and name = '$Name' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    $uri = "https://www.googleapis.com/drive/v3/files?q=$([uri]::EscapeDataString($q))&fields=files(id,name)"
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    if ($resp.files.Count -eq 0) { return $null }
    return $resp.files[0].id
}

function Sync-DriveFolder {
    param([string]$FolderId, [string]$LocalDir)

    if (-not $FolderId) { return }

    $q = "'$FolderId' in parents and trashed = false"
    $uri = "https://www.googleapis.com/drive/v3/files?q=$([uri]::EscapeDataString($q))&fields=files(id,name,modifiedTime,md5Checksum)"
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get

    foreach ($file in $resp.files) {
        $localPath = Join-Path $LocalDir $file.name

        # No duplicar: si ya existe un archivo con el mismo nombre, se omite.
        # (Si se quiere detectar cambios de contenido, comparar $file.md5Checksum
        # contra un hash local guardado — no implementado en esta versión mínima.)
        if (Test-Path $localPath) {
            Write-Host "  = $($file.name) (ya existe, se omite)"
            continue
        }

        $downloadUri = "https://www.googleapis.com/drive/v3/files/$($file.id)?alt=media"
        Invoke-WebRequest -Uri $downloadUri -Headers $headers -OutFile $localPath
        Write-Host "  + $($file.name) (descargado)"
    }
}

Write-Host "Sincronizando assets de '$Cliente' desde Drive (carpeta $DriveFolderId)..."

$fotosId = Get-DriveSubfolderId -ParentId $DriveFolderId -Name "fotos"
$videosId = Get-DriveSubfolderId -ParentId $DriveFolderId -Name "videos"

Write-Host "Fotos:"
Sync-DriveFolder -FolderId $fotosId -LocalDir $fotosDir

Write-Host "Videos:"
Sync-DriveFolder -FolderId $videosId -LocalDir $videosDir

Write-Host "Listo. Assets en $clienteDir\assets\"
