#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Unit tests para hooks/validar-publicacion.ps1 (PreToolUse).
Verifica la barrera tecnica: sin .plan.json aprobado, debe bloquear (exit 2);
con uno aprobado, debe permitir (exit 0); tools no relevantes deben ignorarse (exit 0).
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:HookPath = Join-Path $AgenciaRoot ".claude\hooks\validar-publicacion.ps1"
    $script:TestCliente = "_test-pester-tmp"
    $script:ClienteDir = Join-Path $AgenciaRoot "clientes\$TestCliente"
    $script:HistorialDir = Join-Path $ClienteDir "historial"

    function Invoke-Hook([string]$JsonInput) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell"
        $psi.Arguments = "-NoProfile -File `"$HookPath`""
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.StandardInput.Write($JsonInput)
        $proc.StandardInput.Close()
        $stdout = $proc.StandardOutput.ReadToEnd()
        $stderr = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()
        [PSCustomObject]@{
            ExitCode = $proc.ExitCode
            StdOut   = $stdout
            StdErr   = $stderr
        }
    }
}

Describe "validar-publicacion.ps1" {

    BeforeEach {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
        New-Item -ItemType Directory -Force -Path $HistorialDir | Out-Null
    }

    AfterAll {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
    }

    Context "Tool no relacionada con publicacion/gasto" {
        It "permite la llamada sin evaluar planes (exit 0)" {
            $r = Invoke-Hook '{"tool_name":"mcp__gworkspace__list_recent_files","tool_input":{}}'
            $r.ExitCode | Should -Be 0
        }
    }

    Context "Tool de publicacion sin plan aprobado" {
        It "bloquea la llamada (exit 2)" {
            $r = Invoke-Hook (@{ tool_name = "mcp__postiz__publish_post"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $r.ExitCode | Should -Be 2
        }
        It "explica el motivo del bloqueo en stderr" {
            $r = Invoke-Hook (@{ tool_name = "mcp__postiz__publish_post"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $r.StdErr | Should -Match "BLOQUEADO"
        }
    }

    Context "Tool de publicacion con un plan aprobado presente" {
        BeforeEach {
            $plan = @{
                cliente  = $TestCliente
                aprobado = $true
                estado   = "aprobado"
            } | ConvertTo-Json
            Set-Content -Path (Join-Path $HistorialDir "2026-01-01-test.plan.json") -Value $plan -Encoding UTF8
        }
        It "permite la llamada (exit 0)" {
            $r = Invoke-Hook (@{ tool_name = "mcp__postiz__publish_post"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $r.ExitCode | Should -Be 0
        }
    }

    Context "Tool de publicacion con un plan presente pero NO aprobado" {
        BeforeEach {
            $plan = @{
                cliente  = $TestCliente
                aprobado = $false
                estado   = "pendiente_aprobacion"
            } | ConvertTo-Json
            Set-Content -Path (Join-Path $HistorialDir "2026-01-01-pendiente.plan.json") -Value $plan -Encoding UTF8
        }
        It "sigue bloqueando (exit 2) - un plan sin aprobar no habilita la publicacion" {
            $r = Invoke-Hook (@{ tool_name = "mcp__postiz__publish_post"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $r.ExitCode | Should -Be 2
        }
    }

    Context "Tool de gasto (Meta Ads) sin plan aprobado" {
        It "bloquea igual que publicacion (exit 2)" {
            $r = Invoke-Hook (@{ tool_name = "mcp__meta-ads__create_campaign"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $r.ExitCode | Should -Be 2
        }
    }

    Context "tool_input sin campo 'cliente'" {
        It "bloquea (no se puede verificar aprobacion sin saber de que cliente se trata)" {
            $r = Invoke-Hook (@{ tool_name = "mcp__postiz__publish_post"; tool_input = @{} } | ConvertTo-Json)
            $r.ExitCode | Should -Be 2
        }
    }

    Context "Aislamiento entre clientes (regresion)" {
        BeforeEach {
            # Cliente distinto, CON plan aprobado - no debe habilitar publicar para $TestCliente.
            $otroCliente = "_test-pester-otro"
            $otroHistorial = Join-Path $AgenciaRoot "clientes\$otroCliente\historial"
            New-Item -ItemType Directory -Force -Path $otroHistorial | Out-Null
            $plan = @{ cliente = $otroCliente; aprobado = $true } | ConvertTo-Json
            Set-Content -Path (Join-Path $otroHistorial "plan.json") -Value $plan -Encoding UTF8
        }
        AfterEach {
            $otroDir = Join-Path $AgenciaRoot "clientes\_test-pester-otro"
            if (Test-Path $otroDir) { Remove-Item -Recurse -Force $otroDir }
        }
        It "un plan aprobado de OTRO cliente no habilita publicar para este cliente (sin plan propio)" {
            $r = Invoke-Hook (@{ tool_name = "mcp__postiz__publish_post"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $r.ExitCode | Should -Be 2
        }
    }
}
