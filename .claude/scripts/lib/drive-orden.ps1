# Funciones compartidas por descargar-assets.ps1 y sus tests.
# Convención completa: docs/orden-del-drive.md

$script:MimeCarpeta = 'application/vnd.google-apps.folder'
$script:DriveHeaders = @{}

# Secciones de primer nivel del Drive -> destino local (relativo a clientes/<c>/assets/) y tipo de archivo.
# Destino $null = la sección existe en la convención pero no se descarga (se lee con el conector).
$script:Secciones = @{
    'brief-y-manual'   = @{ Destino = $null;       Mime = $null }
    'identidad-visual' = @{ Destino = 'identidad'; Mime = '^(?!application/vnd\.google-apps)' }
    'fotos'            = @{ Destino = 'fotos';     Mime = '^image/' }
    'videos'           = @{ Destino = 'videos';    Mime = '^video/' }
    'otros'            = @{ Destino = $null;       Mime = $null }
    'agente'           = @{ Destino = $null;       Mime = $null }   # lo escribe /sincronizar-drive; nunca se descarga
}

function ConvertTo-Slug {
    # minúsculas, sin tildes, todo lo que no sea a-z0-9 pasa a guion.
    param([string]$Texto)
    $n = $Texto.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($c in $n.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($c)
        }
    }
    return ([regex]::Replace($sb.ToString().ToLowerInvariant(), '[^a-z0-9]+', '-')).Trim('-')
}

function ConvertTo-NombreArchivo {
    param([string]$Nombre)
    $ext = [IO.Path]::GetExtension($Nombre).ToLowerInvariant()
    $base = ConvertTo-Slug ([IO.Path]::GetFileNameWithoutExtension($Nombre))
    if (-not $base) { $base = 'archivo' }
    return "$base$ext"
}

function Resolve-SeccionDrive {
    # "03 Fotos", "03-fotos" y "Fotos" son la misma sección. Devuelve $null si no se reconoce.
    param([string]$Nombre)
    $slug = (ConvertTo-Slug $Nombre) -replace '^\d+-', ''
    if ($script:Secciones.ContainsKey($slug)) { return $slug }
    return $null
}

function Get-DriveHijos {
    param([string]$FolderId)
    $pageToken = $null
    do {
        $q = "'$FolderId' in parents and trashed = false"
        $uri = "https://www.googleapis.com/drive/v3/files?q=$([uri]::EscapeDataString($q))" +
               "&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true" +
               "&fields=nextPageToken,files(id,name,mimeType,md5Checksum,size)"
        if ($pageToken) { $uri += "&pageToken=$([uri]::EscapeDataString($pageToken))" }
        $r = Invoke-RestMethod -Uri $uri -Headers $script:DriveHeaders -Method Get
        $r.files
        $pageToken = $r.nextPageToken
    } while ($pageToken)
}

function Save-DriveArchivo {
    param([string]$FileId, [string]$Destino)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destino) | Out-Null
    $tmp = "$Destino.part"
    $uri = "https://www.googleapis.com/drive/v3/files/$FileId`?alt=media&supportsAllDrives=true"
    Invoke-WebRequest -Uri $uri -Headers $script:DriveHeaders -OutFile $tmp
    Move-Item -Force -Path $tmp -Destination $Destino
}

function Get-Md5Local {
    param([string]$Ruta)
    (Get-FileHash -Algorithm MD5 -Path $Ruta).Hash.ToLowerInvariant()
}

function Read-Manifiesto {
    # id de Drive -> @{ ruta (relativa a assets, con /); md5 }
    param([string]$Path)
    $m = @{}
    if (Test-Path $Path) {
        $json = Get-Content -Raw -Path $Path | ConvertFrom-Json
        foreach ($p in $json.PSObject.Properties) {
            $m[$p.Name] = @{ ruta = $p.Value.ruta; md5 = $p.Value.md5 }
        }
    }
    return $m
}

function Save-Manifiesto {
    param([string]$Path, [hashtable]$Manifiesto)
    $Manifiesto | ConvertTo-Json -Depth 4 | Set-Content -Path $Path -Encoding UTF8
}

function Sync-CarpetaDrive {
    <#
    Descarga recursivamente $FolderId a $LocalDir (que cuelga de $AssetsDir) preservando
    subcarpetas con nombres normalizados. Idempotente vía manifiesto id->ruta+md5.
    $Resumen: hashtable con contadores y listas Avisos/Errores.
    #>
    param(
        [string]$FolderId, [string]$LocalDir, [string]$AssetsDir,
        [string]$MimeRegex, [hashtable]$Manifiesto, [hashtable]$Resumen,
        [string]$RutaDrive, [int]$Nivel = 0, [switch]$DryRun
    )

    foreach ($item in @(Get-DriveHijos -FolderId $FolderId)) {
        $rutaDrive = "$RutaDrive/$($item.name)"

        if ($item.mimeType -eq $script:MimeCarpeta) {
            if ($Nivel -ge 3) { $Resumen.Avisos += "Carpeta demasiado profunda (máx. 3 niveles bajo la sección): $rutaDrive" }
            $sub = ConvertTo-Slug $item.name
            if (-not $sub) { $sub = 'sin-nombre' }
            Sync-CarpetaDrive -FolderId $item.id -LocalDir (Join-Path $LocalDir $sub) -AssetsDir $AssetsDir `
                -MimeRegex $MimeRegex -Manifiesto $Manifiesto -Resumen $Resumen `
                -RutaDrive $rutaDrive -Nivel ($Nivel + 1) -DryRun:$DryRun
            continue
        }

        if ($item.mimeType -notmatch $MimeRegex) {
            $Resumen.Omitidos++
            $Resumen.Avisos += "Tipo no esperado en esta sección ($($item.mimeType)), se omite: $rutaDrive"
            continue
        }
        if ($Nivel -eq 0) { $Resumen.Avisos += "Archivo suelto, sin categoría: $rutaDrive" }

        try {
            $nombre = ConvertTo-NombreArchivo $item.name
            $id = $item.id
            $accion = $null

            if ($Manifiesto.ContainsKey($id)) {
                $rel = $Manifiesto[$id].ruta
                $full = Join-Path $AssetsDir $rel
                if ((Test-Path $full) -and (-not $item.md5Checksum -or (Get-Md5Local $full) -eq $item.md5Checksum)) {
                    $Resumen.Existentes++; continue
                }
                $accion = if (Test-Path $full) { 'actualizado' } else { 'descargado' }
            }
            else {
                $rel = ((Join-Path $LocalDir $nombre).Substring($AssetsDir.Length).TrimStart('\', '/')) -replace '\\', '/'
                $full = Join-Path $AssetsDir $rel
                $ocupada = $Manifiesto.Values | Where-Object { $_.ruta -eq $rel }
                if ($ocupada) {
                    $accion = 'renombrado'
                }
                elseif (Test-Path $full) {
                    if ($item.md5Checksum -and (Get-Md5Local $full) -eq $item.md5Checksum) {
                        # descarga previa a este script: se adopta sin volver a bajar
                        $Manifiesto[$id] = @{ ruta = $rel; md5 = $item.md5Checksum }
                        $Resumen.Existentes++; continue
                    }
                    $accion = 'renombrado'
                }
                else { $accion = 'descargado' }

                if ($accion -eq 'renombrado') {
                    # mismo nombre, contenido distinto: sufijo con el id de Drive
                    $suf = $id.Substring(0, [Math]::Min(6, $id.Length)).ToLowerInvariant()
                    $nombre = "$([IO.Path]::GetFileNameWithoutExtension($nombre))-$suf$([IO.Path]::GetExtension($nombre))"
                    $rel = ((Join-Path $LocalDir $nombre).Substring($AssetsDir.Length).TrimStart('\', '/')) -replace '\\', '/'
                    $full = Join-Path $AssetsDir $rel
                    $accion = 'descargado'
                }
            }

            if ($DryRun) { Write-Host "  ? $rel ($accion)"; $Resumen.Pendientes++; continue }

            Save-DriveArchivo -FileId $id -Destino $full
            $Manifiesto[$id] = @{ ruta = $rel; md5 = $item.md5Checksum }
            $Resumen[$(if ($accion -eq 'actualizado') { 'Actualizados' } else { 'Descargados' })]++
            if ($item.size) { $Resumen.Bytes += [int64]$item.size }
            Write-Host "  + $rel ($accion)"
        }
        catch {
            $Resumen.Errores += "$rutaDrive : $($_.Exception.Message)"
        }
    }
}

function New-Resumen {
    @{ Descargados = 0; Actualizados = 0; Existentes = 0; Omitidos = 0; Pendientes = 0
       Bytes = [int64]0; Avisos = @(); Errores = @() }
}
