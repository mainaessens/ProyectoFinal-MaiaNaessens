#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Tests de validar-publicacion.ps1 v2 (Fase 8): gasto en Meta Ads.
Un plan de publicacion aprobado NO habilita gasto; el gasto exige una aprobacion propia
(*.ads.json) con monto exacto, tope mensual en limites.json y campanias en pausa.
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:HookPath = Join-Path $AgenciaRoot ".claude\hooks\validar-publicacion.ps1"
    $script:Cliente = "pester-gasto"
    $script:ClienteDir = Join-Path $AgenciaRoot "clientes\$Cliente"
    $script:HistorialDir = Join-Path $ClienteDir "historial"
    $script:LimitesTmp = Join-Path ([System.IO.Path]::GetTempPath()) "pester-limites.json"

    function Invoke-Hook([string]$JsonInput) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell"
        $psi.Arguments = "-NoProfile -File `"$HookPath`""
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.EnvironmentVariables["AGENCIA_LIMITES_PATH"] = $LimitesTmp
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.StandardInput.Write($JsonInput)
        $proc.StandardInput.Close()
        $stdout = $proc.StandardOutput.ReadToEnd()
        $stderr = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()
        [PSCustomObject]@{ ExitCode = $proc.ExitCode; StdOut = $stdout; StdErr = $stderr }
    }

    function Merge([hashtable]$base, [hashtable]$over) {
        $out = @{} + $base
        foreach ($k in $over.Keys) { $out[$k] = $over[$k] }
        $out
    }

    function Call([string]$tool, [hashtable]$extra = @{}) {
        $ti = Merge @{ cliente = $Cliente } $extra
        Invoke-Hook (@{ tool_name = $tool; tool_input = $ti } | ConvertTo-Json -Depth 5)
    }

    function Set-Limites([double]$tope) {
        @{ clientes = @{ $Cliente = @{ tope_mensual = $tope } } } | ConvertTo-Json -Depth 5 |
            Set-Content -Path $LimitesTmp -Encoding UTF8
    }

    function Set-Aprobacion([hashtable]$props) {
        $base = @{ cliente = $Cliente; aprobado = $true; monto_confirmado = 150
                   fecha_aprobacion = (Get-Date).ToString("yyyy-MM-dd"); duracion_dias = 14 }
        (Merge $base $props) | ConvertTo-Json | Set-Content -Path (Join-Path $HistorialDir "camp.ads.json") -Encoding UTF8
    }
}

Describe "validar-publicacion.ps1 v2 - gasto Meta Ads" {

    BeforeEach {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
        New-Item -ItemType Directory -Force -Path $HistorialDir | Out-Null
        Set-Limites 500
    }
    AfterAll {
        if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
        if (Test-Path $LimitesTmp) { Remove-Item -Force $LimitesTmp }
    }

    It "un plan de PUBLICACION aprobado no habilita gasto" {
        @{ cliente = $Cliente; aprobado = $true; fecha_programada = "2026-11-03" } | ConvertTo-Json |
            Set-Content -Path (Join-Path $HistorialDir "post.plan.json") -Encoding UTF8
        (Call "mcp__meta-ads__create_campaign").ExitCode | Should -Be 2
    }

    It "bloquea si el cliente no tiene tope en limites.json" {
        Set-Aprobacion @{}
        @{ clientes = @{} } | ConvertTo-Json | Set-Content -Path $LimitesTmp -Encoding UTF8
        (Call "mcp__meta-ads__create_campaign").ExitCode | Should -Be 2
    }

    It "bloquea si el tope es 0" {
        Set-Aprobacion @{}
        Set-Limites 0
        (Call "mcp__meta-ads__create_campaign").ExitCode | Should -Be 2
    }

    It "permite crear en pausa con aprobacion vigente dentro del tope" {
        Set-Aprobacion @{}
        (Call "mcp__meta-ads__create_campaign" @{ status = "PAUSED" }).ExitCode | Should -Be 0
    }

    It "bloquea crear una campania ACTIVA" {
        Set-Aprobacion @{}
        (Call "mcp__meta-ads__create_campaign" @{ status = "ACTIVE" }).ExitCode | Should -Be 2
    }

    It "bloquea si el monto de la llamada supera el monto confirmado" {
        Set-Aprobacion @{ monto_confirmado = 150 }
        (Call "mcp__meta-ads__create_adset" @{ monto = 200; status = "PAUSED" }).ExitCode | Should -Be 2
    }

    It "permite si el monto de la llamada es igual al confirmado" {
        Set-Aprobacion @{ monto_confirmado = 150 }
        (Call "mcp__meta-ads__create_adset" @{ monto = 150; status = "PAUSED" }).ExitCode | Should -Be 0
    }

    It "calcula daily_budget (centavos) x duracion y bloquea si excede" {
        Set-Aprobacion @{ monto_confirmado = 150; duracion_dias = 14 }   # 14 dias
        # 1500 centavos = 15/dia x 14 = 210 > 150
        (Call "mcp__meta-ads__create_adset" @{ daily_budget = 1500; status = "PAUSED" }).ExitCode | Should -Be 2
        # 1000 centavos = 10/dia x 14 = 140 <= 150
        (Call "mcp__meta-ads__create_adset" @{ daily_budget = 1000; status = "PAUSED" }).ExitCode | Should -Be 0
    }

    It "bloquea cuando las aprobaciones del mes superan el tope mensual" {
        Set-Aprobacion @{ monto_confirmado = 600 }
        (Call "mcp__meta-ads__create_campaign" @{ status = "PAUSED" }).ExitCode | Should -Be 2
    }

    It "activar exige segunda confirmacion" {
        Set-Aprobacion @{}
        (Call "mcp__meta-ads__update_campaign" @{ status = "ACTIVE" }).ExitCode | Should -Be 2
        Set-Aprobacion @{ activacion_confirmada = $true }
        (Call "mcp__meta-ads__update_campaign" @{ status = "ACTIVE" }).ExitCode | Should -Be 0
    }

    It "una aprobacion NO aprobada no habilita" {
        Set-Aprobacion @{ aprobado = $false }
        (Call "mcp__meta-ads__create_campaign" @{ status = "PAUSED" }).ExitCode | Should -Be 2
    }

    It "rechaza nombres de cliente con path traversal" {
        $r = Invoke-Hook (@{ tool_name = "mcp__meta-ads__create_campaign"; tool_input = @{ cliente = "..\x" } } | ConvertTo-Json)
        $r.ExitCode | Should -Be 2
    }
}
