#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Tests de la lógica de orden/descarga de Drive (lib/drive-orden.ps1) con un Drive simulado:
no toca la red.
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    . (Join-Path $AgenciaRoot ".claude\scripts\lib\drive-orden.ps1")
}

Describe "Normalización de nombres" {
    It "ConvertTo-Slug quita tildes, espacios y símbolos" {
        ConvertTo-Slug "Piso Flotante 7 mm — Ed. San Martín" | Should -Be "piso-flotante-7-mm-ed-san-martin"
    }
    It "ConvertTo-NombreArchivo conserva la extensión en minúsculas" {
        ConvertTo-NombreArchivo "Foto Living 01.JPG" | Should -Be "foto-living-01.jpg"
    }
    It "Resolve-SeccionDrive tolera prefijo numérico, mayúsculas y tildes" {
        Resolve-SeccionDrive "03 Fotos" | Should -Be "fotos"
        Resolve-SeccionDrive "04-VIDEOS" | Should -Be "videos"
        Resolve-SeccionDrive "02 Identidad visual" | Should -Be "identidad-visual"
        Resolve-SeccionDrive "06 Agente" | Should -Be "agente"
        Resolve-SeccionDrive "Pedidas" | Should -BeNullOrEmpty
    }
}

Describe "Sync-CarpetaDrive" {
    BeforeEach {
        $script:Assets = Join-Path $TestDrive "assets-$([guid]::NewGuid().ToString('N'))"
        New-Item -ItemType Directory -Force -Path $Assets | Out-Null
        $script:Arbol = @{
            raiz = @(
                @{ id = 'sueltaAAAA'; name = 'Suelta.jpg'; mimeType = 'image/jpeg'; md5Checksum = 'm1' }
                @{ id = 'carpTrab'; name = 'Trabajos'; mimeType = 'application/vnd.google-apps.folder' }
            )
            carpTrab = @(
                @{ id = 'carpObra'; name = '2026-03 Obra Ñandú'; mimeType = 'application/vnd.google-apps.folder' }
            )
            carpObra = @(
                @{ id = 'f1aaaaaa'; name = 'Living 1.JPG'; mimeType = 'image/jpeg'; md5Checksum = 'a1'; size = '10' }
                @{ id = 'f2bbbbbb'; name = 'Living 1.jpg'; mimeType = 'image/jpeg'; md5Checksum = 'a2'; size = '10' }
                @{ id = 'docX'; name = 'notas'; mimeType = 'application/vnd.google-apps.document' }
            )
        }
        Mock Get-DriveHijos { $script:Arbol[$FolderId] }
        Mock Save-DriveArchivo {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destino) | Out-Null
            Set-Content -Path $Destino -Value "x"
        }
        Mock Get-Md5Local { 'a1' }
    }

    It "descarga con subcarpetas normalizadas, resuelve colisiones y avisa del desorden" {
        $m = @{}; $r = New-Resumen
        Sync-CarpetaDrive -FolderId raiz -LocalDir (Join-Path $Assets 'fotos') -AssetsDir $Assets `
            -MimeRegex '^image/' -Manifiesto $m -Resumen $r -RutaDrive '03 Fotos'

        Test-Path (Join-Path $Assets 'fotos\trabajos\2026-03-obra-nandu\living-1.jpg') | Should -BeTrue
        Test-Path (Join-Path $Assets 'fotos\trabajos\2026-03-obra-nandu\living-1-f2bbbb.jpg') | Should -BeTrue
        Test-Path (Join-Path $Assets 'fotos\suelta.jpg') | Should -BeTrue
        $r.Descargados | Should -Be 3
        $r.Omitidos | Should -Be 1
        ($r.Avisos -join "`n") | Should -Match 'sin categoría'
        ($r.Avisos -join "`n") | Should -Match 'Tipo no esperado'
    }

    It "no re-descarga lo que ya está en el manifiesto" {
        $m = @{}; $r = New-Resumen
        Sync-CarpetaDrive -FolderId raiz -LocalDir (Join-Path $Assets 'fotos') -AssetsDir $Assets `
            -MimeRegex '^image/' -Manifiesto $m -Resumen $r -RutaDrive '03 Fotos'
        Mock Get-Md5Local { param($Ruta) if ($Ruta -like '*living-1.jpg') { 'a1' } elseif ($Ruta -like '*f2bbbb*') { 'a2' } else { 'm1' } }
        $r2 = New-Resumen
        Sync-CarpetaDrive -FolderId raiz -LocalDir (Join-Path $Assets 'fotos') -AssetsDir $Assets `
            -MimeRegex '^image/' -Manifiesto $m -Resumen $r2 -RutaDrive '03 Fotos'
        $r2.Descargados | Should -Be 0
        $r2.Existentes | Should -Be 3
    }

    It "DryRun no escribe archivos" {
        $m = @{}; $r = New-Resumen
        Sync-CarpetaDrive -FolderId raiz -LocalDir (Join-Path $Assets 'fotos') -AssetsDir $Assets `
            -MimeRegex '^image/' -Manifiesto $m -Resumen $r -RutaDrive '03 Fotos' -DryRun
        Test-Path (Join-Path $Assets 'fotos') | Should -BeFalse
        $r.Pendientes | Should -Be 3
    }
}
