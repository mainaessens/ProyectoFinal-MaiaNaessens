#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Unit tests para hooks/registrar-actividad.ps1 (PostToolUse).
Verifica que registre en el log del cliente correcto, y que ignore tools irrelevantes.
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:HookPath = Join-Path $AgenciaRoot ".claude\hooks\registrar-actividad.ps1"
    $script:TestCliente = "_test-pester-audit"
    $script:ClienteDir = Join-Path $AgenciaRoot "clientes\$TestCliente"
    $script:LogPath = Join-Path $ClienteDir "registro-actividad.log"
    $script:LogGeneral = Join-Path $AgenciaRoot ".claude\registro-actividad-general.log"

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
        $proc.StandardOutput.ReadToEnd() | Out-Null
        $proc.StandardError.ReadToEnd() | Out-Null
        $proc.WaitForExit()
        $proc.ExitCode
    }
}

Describe "registrar-actividad.ps1" {

    BeforeEach {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
        New-Item -ItemType Directory -Force -Path $ClienteDir | Out-Null
        if (Test-Path $LogGeneral) { Remove-Item -Force $LogGeneral }
    }

    AfterAll {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
        if (Test-Path $LogGeneral) { Remove-Item -Force $LogGeneral }
    }

    Context "Tool relevante (Jira) con cliente identificado" {
        It "termina con exit 0" {
            $exit = Invoke-Hook (@{ tool_name = "mcp__atlassian__transitionJiraIssue"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json)
            $exit | Should -Be 0
        }
        It "agrega una linea al log del cliente" {
            Invoke-Hook (@{ tool_name = "mcp__atlassian__transitionJiraIssue"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json) | Out-Null
            Test-Path $LogPath | Should -BeTrue
            (Get-Content $LogPath) | Should -Match "mcp__atlassian__transitionJiraIssue"
        }
        It "la linea incluye el nombre del cliente" {
            Invoke-Hook (@{ tool_name = "mcp__atlassian__transitionJiraIssue"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json) | Out-Null
            (Get-Content $LogPath) | Should -Match "cliente=$TestCliente"
        }
    }

    Context "Tool irrelevante (no publicacion/jira)" {
        It "no crea ni modifica ningun log" {
            Invoke-Hook (@{ tool_name = "Read"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json) | Out-Null
            Test-Path $LogPath | Should -BeFalse
        }
    }

    Context "Tool relevante sin cliente identificable en tool_input" {
        It "cae al log general de la agencia en vez de fallar" {
            Invoke-Hook (@{ tool_name = "mcp__instagram__publicar_imagen"; tool_input = @{} } | ConvertTo-Json) | Out-Null
            Test-Path $LogGeneral | Should -BeTrue
        }
    }

    Context "Multiples llamadas" {
        It "cada llamada agrega una linea nueva, sin sobrescribir el log" {
            Invoke-Hook (@{ tool_name = "mcp__atlassian__transitionJiraIssue"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json) | Out-Null
            Invoke-Hook (@{ tool_name = "mcp__instagram__publicar_imagen"; tool_input = @{ cliente = $TestCliente } } | ConvertTo-Json) | Out-Null
            (Get-Content $LogPath).Count | Should -Be 2
        }
    }
}
