#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Valida que todos los .plan.json generados por /crear-post en clientes/*/historial/ cumplan
el esquema minimo esperado por validar-publicacion.ps1 y por el resto del sistema.
#>

BeforeDiscovery {
    $discoAgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:PlanFiles = @(Get-ChildItem -Path (Join-Path $discoAgenciaRoot "clientes") -Recurse -Filter "*.plan.json" -ErrorAction SilentlyContinue |
        Where-Object { $_.Directory.Parent.Name -notmatch "^_test-pester" })
}

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
}

Describe "Esquema de archivos .plan.json" {

    It "hay al menos un .plan.json para validar (requiere haber corrido /crear-post antes)" {
        $PlanFiles.Count | Should -BeGreaterThan 0
    }

    Context "Cada plan.json existente" {

        It "es JSON valido" -ForEach $PlanFiles {
            { Get-Content -Raw $_.FullName | ConvertFrom-Json } | Should -Not -Throw
        }

        It "tiene el campo 'cliente'" -ForEach $PlanFiles {
            $plan = Get-Content -Raw $_.FullName | ConvertFrom-Json
            $plan.cliente | Should -Not -BeNullOrEmpty
        }

        It "el campo 'aprobado' es booleano" -ForEach $PlanFiles {
            $plan = Get-Content -Raw $_.FullName | ConvertFrom-Json
            $plan.aprobado | Should -BeOfType [bool]
        }

        It "si aprobado=true, tiene fecha_programada" -ForEach $PlanFiles {
            $plan = Get-Content -Raw $_.FullName | ConvertFrom-Json
            if ($plan.aprobado -eq $true) {
                $plan.fecha_programada | Should -Not -BeNullOrEmpty
            }
        }

        It "el 'cliente' del plan coincide con la carpeta que lo contiene" -ForEach $PlanFiles {
            $plan = Get-Content -Raw $_.FullName | ConvertFrom-Json
            $carpetaCliente = Split-Path -Leaf (Split-Path -Parent (Split-Path -Parent $_.FullName))
            $plan.cliente | Should -Be $carpetaCliente
        }
    }
}
