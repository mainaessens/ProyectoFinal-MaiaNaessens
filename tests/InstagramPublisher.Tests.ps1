#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Conector de Instagram: corre los tests de Node (Graph API simulada) y verifica que el hook
trate las herramientas del conector como publicacion (bloquea sin plan aprobado).
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:HookPath = Join-Path $AgenciaRoot ".claude\hooks\validar-publicacion.ps1"
    $script:Cliente = "pester-ig"
    $script:ClienteDir = Join-Path $AgenciaRoot "clientes\$Cliente"

    function Invoke-Hook([string]$JsonInput) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell"
        $psi.Arguments = "-NoProfile -File `"$HookPath`""
        $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.StandardInput.Write($JsonInput); $proc.StandardInput.Close()
        $null = $proc.StandardOutput.ReadToEnd(); $null = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()
        $proc.ExitCode
    }
}

Describe "Conector de Instagram" {

    It "los tests de Node del conector pasan" -Skip:(-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Push-Location (Join-Path $AgenciaRoot "mcp\instagram-publisher")
        try {
            $out = & node --test 2>&1 | Out-String
            $LASTEXITCODE | Should -Be 0 -Because $out
        } finally { Pop-Location }
    }

    Context "Hook" {
        BeforeEach {
            if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir }
            New-Item -ItemType Directory -Force -Path (Join-Path $ClienteDir "historial") | Out-Null
        }
        AfterAll { if (Test-Path $ClienteDir) { Remove-Item -Recurse -Force $ClienteDir } }

        It "bloquea publicar_imagen sin plan aprobado" {
            $j = @{ tool_name = "mcp__instagram__publicar_imagen"; tool_input = @{ cliente = $Cliente } } | ConvertTo-Json
            Invoke-Hook $j | Should -Be 2
        }
        It "bloquea subir_archivo_publico sin plan aprobado" {
            $j = @{ tool_name = "mcp__instagram__subir_archivo_publico"; tool_input = @{ cliente = $Cliente } } | ConvertTo-Json
            Invoke-Hook $j | Should -Be 2
        }
        It "permite publicar_imagen con plan aprobado del cliente" {
            @{ cliente = $Cliente; aprobado = $true } | ConvertTo-Json |
                Set-Content -Path (Join-Path $ClienteDir "historial\x.plan.json") -Encoding UTF8
            $j = @{ tool_name = "mcp__instagram__publicar_imagen"; tool_input = @{ cliente = $Cliente } } | ConvertTo-Json
            Invoke-Hook $j | Should -Be 0
        }
        It "no bloquea ver_cuenta (solo lectura)" {
            $j = @{ tool_name = "mcp__instagram__ver_cuenta"; tool_input = @{ cliente = $Cliente } } | ConvertTo-Json
            Invoke-Hook $j | Should -Be 0
        }
    }
}
