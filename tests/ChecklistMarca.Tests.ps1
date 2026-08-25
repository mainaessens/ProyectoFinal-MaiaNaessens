#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Unit tests para scripts/checklist-marca.ps1.
Verifica deteccion de violaciones de restricciones del perfil, y ausencia de falsos
positivos en textos limpios.
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:ScriptPath = Join-Path $AgenciaRoot ".claude\scripts\checklist-marca.ps1"
    $script:TestCliente = "_test-pester-checklist"
    $script:ClienteDir = Join-Path $AgenciaRoot "clientes\$TestCliente"
    $script:PerfilPath = Join-Path $ClienteDir "perfil.md"

    $script:PerfilContenido = @"
# Perfil de cliente

## Identidad

- **Nombre del cliente:** Cliente de test

## Restricciones — qué NO publicar

- No prometer empleo garantizado
- No publicar precios de cursos en el feed
- No mencionar competidores por nombre
"@
}

Describe "checklist-marca.ps1" {

    BeforeEach {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
        New-Item -ItemType Directory -Force -Path $ClienteDir | Out-Null
        Set-Content -Path $PerfilPath -Value $PerfilContenido -Encoding UTF8
    }

    AfterAll {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
    }

    Context "Texto que viola una restriccion (empleo garantizado)" {
        It "termina con exit code distinto de 0 (alerta)" {
            & $ScriptPath -Cliente $TestCliente -Texto "Con este curso te garantizamos empleo en 3 meses" *> $null
            $LASTEXITCODE | Should -Not -Be 0
        }
    }

    Context "Texto que viola una restriccion (precio)" {
        It "detecta la mencion de precio" {
            & $ScriptPath -Cliente $TestCliente -Texto "Precio especial: 50000 pesos por el curso" *> $null
            $LASTEXITCODE | Should -Not -Be 0
        }
    }

    Context "Texto limpio, sin violaciones" {
        It "termina con exit code 0" {
            & $ScriptPath -Cliente $TestCliente -Texto "Conoce la historia de nuestros egresados" *> $null
            $LASTEXITCODE | Should -Be 0
        }
    }

    Context "Cliente sin perfil.md" {
        It "lanza un error claro en vez de fallar silenciosamente" {
            { & $ScriptPath -Cliente "_cliente-inexistente-pester" -Texto "cualquier texto" -ErrorAction Stop } | Should -Throw
        }
    }

    Context "Parametro -TextoPath en vez de -Texto" {
        It "lee el texto desde el archivo indicado" {
            $textoPath = Join-Path $ClienteDir "caption-temporal.txt"
            Set-Content -Path $textoPath -Value "Contenido neutro sin restricciones" -Encoding UTF8
            & $ScriptPath -Cliente $TestCliente -TextoPath $textoPath *> $null
            $LASTEXITCODE | Should -Be 0
        }
    }
}
