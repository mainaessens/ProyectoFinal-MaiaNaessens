<#
.SYNOPSIS
    Sincroniza el material de la carpeta de Drive de un cliente hacia clientes/<nombre>/assets/,
    siguiendo la convención de orden de docs/orden-del-drive.md.

.DESCRIPTION
    Lee las secciones de primer nivel del Drive (tolera prefijo numérico y mayúsculas/tildes):

        Drive                         ->  clientes/<c>/assets/
        03-fotos/<cat>/<tema>/...     ->  fotos/<cat>/<tema>/...
        04-videos/<cat>/...           ->  videos/<cat>/...
        02-identidad-visual/...       ->  identidad/...
        01-brief-y-manual, 05-otros   ->  no se descargan (se leen con el conector)

    - Recursivo y con paginación (más de 100 archivos).
    - Nombres locales normalizados (minúsculas, sin tildes ni espacios).
    - Idempotente: assets/.drive-manifest.json recuerda id de Drive -> ruta + md5. No re-descarga
      lo que no cambió, actualiza lo que cambió en Drive y nunca borra nada local.
    - Solo lee Drive; no mueve, renombra ni borra nada allá.
    - Avisa de desorden (archivos sueltos, tipos inesperados, carpetas muy profundas,
      secciones no reconocidas) sin frenar la descarga.

    Requiere la variable de entorno GOOGLE_ACCESS_TOKEN (token OAuth con acceso de lectura a Drive).
    Con el conector de plataforma (sin CLI), el agente aplica estas mismas reglas con
    download_file_content archivo por archivo.

.PARAMETER Cliente
    Carpeta del cliente en clientes/<nombre>/ (debe existir).

.PARAMETER DriveFolderId
    ID de la carpeta raíz de Drive del cliente (si falta, se toma la URL de perfil.md).

.PARAMETER DryRun
    Solo muestra qué se descargaría.

.EXAMPLE
    ./descargar-assets.ps1 -Cliente cafe-lunar -DriveFolderId 1AbCdEfGhIjKlmNoPQRstuv -DryRun
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Cliente,

    [string]$DriveFolderId,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "lib\drive-orden.ps1")

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$clienteDir = Join-Path $agenciaRoot "clientes\$Cliente"
$perfilPath = Join-Path $clienteDir "perfil.md"
$assetsDir = Join-Path $clienteDir "assets"
$manifiestoPath = Join-Path $assetsDir ".drive-manifest.json"

if (-not (Test-Path $clienteDir)) {
    throw "No existe clientes/$Cliente/. Ejecutá primero /nuevo-cliente $Cliente."
}

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

# Token: variable de entorno, o .claude/.env (GOOGLE_ACCESS_TOKEN, o GOOGLE_CLIENT_ID +
# GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN para renovarlo solo). Ver docs/orden-del-drive.md.
$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"
$cfg = @{}
if (Test-Path $envPath) {
    foreach ($l in Get-Content $envPath) {
        if ($l -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { $cfg[$Matches[1]] = $Matches[2] }
    }
}
$token = if ($env:GOOGLE_ACCESS_TOKEN) { $env:GOOGLE_ACCESS_TOKEN } else { $cfg['GOOGLE_ACCESS_TOKEN'] }
if (-not $token -and $cfg['GOOGLE_REFRESH_TOKEN'] -and $cfg['GOOGLE_CLIENT_ID'] -and $cfg['GOOGLE_CLIENT_SECRET']) {
    $r = Invoke-RestMethod -Method Post -Uri "https://oauth2.googleapis.com/token" -Body @{
        client_id = $cfg['GOOGLE_CLIENT_ID']; client_secret = $cfg['GOOGLE_CLIENT_SECRET']
        refresh_token = $cfg['GOOGLE_REFRESH_TOKEN']; grant_type = "refresh_token" }
    $token = $r.access_token
}
if (-not $token) {
    throw "Falta GOOGLE_ACCESS_TOKEN (variable de entorno o .claude/.env). Pasos en docs/orden-del-drive.md, sección 'Token de Drive'."
}
$script:DriveHeaders = @{ Authorization = "Bearer $token" }

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
$manifiesto = Read-Manifiesto -Path $manifiestoPath
$resumen = New-Resumen

Write-Host "Sincronizando '$Cliente' desde Drive (carpeta $DriveFolderId)$(if ($DryRun) { ' [DRY RUN]' })..."

$vistas = @()
foreach ($carpeta in @(Get-DriveHijos -FolderId $DriveFolderId | Where-Object { $_.mimeType -eq $script:MimeCarpeta })) {
    $clave = Resolve-SeccionDrive $carpeta.name
    if (-not $clave) {
        $resumen.Avisos += "Carpeta de primer nivel no reconocida, no se descarga: $($carpeta.name)"
        continue
    }
    $vistas += $clave
    $sec = $script:Secciones[$clave]
    if (-not $sec.Destino) { continue }

    Write-Host "$($carpeta.name) -> assets/$($sec.Destino)/"
    Sync-CarpetaDrive -FolderId $carpeta.id -LocalDir (Join-Path $assetsDir $sec.Destino) -AssetsDir $assetsDir `
        -MimeRegex $sec.Mime -Manifiesto $manifiesto -Resumen $resumen -RutaDrive $carpeta.name -DryRun:$DryRun
}
foreach ($esperada in 'fotos', 'videos') {
    if ($vistas -notcontains $esperada) { $resumen.Avisos += "No hay sección '$esperada' en el Drive (ver docs/orden-del-drive.md)." }
}

if (-not $DryRun) { Save-Manifiesto -Path $manifiestoPath -Manifiesto $manifiesto }

$mb = [math]::Round($resumen.Bytes / 1MB, 1)
Write-Host ""
Write-Host "Resumen: $($resumen.Descargados) descargados, $($resumen.Actualizados) actualizados, $($resumen.Existentes) ya estaban, $($resumen.Omitidos) omitidos, $($resumen.Pendientes) pendientes (dry run), $mb MB."
foreach ($a in $resumen.Avisos) { Write-Warning $a }
foreach ($e in $resumen.Errores) { Write-Host "ERROR: $e" -ForegroundColor Red }
if ($resumen.Errores.Count -gt 0) { exit 1 }
