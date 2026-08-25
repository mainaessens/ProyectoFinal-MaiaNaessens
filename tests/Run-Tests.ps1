<#
.SYNOPSIS
    Corre toda la suite de tests de la carpeta tests/ y devuelve un resumen.

.DESCRIPTION
    Requiere Pester 5+ (instalado con: Install-Module Pester -Scope CurrentUser -MinimumVersion 5.0).
    Uso: ./tests/Run-Tests.ps1
    Exit code 0 si todos los tests pasan, 1 si hay al menos un fallo (apto para CI).
#>

param(
    [switch]$CI
)

Import-Module Pester -MinimumVersion 5.0 -ErrorAction Stop

$config = New-PesterConfiguration
$config.Run.Path = $PSScriptRoot
$config.Run.PassThru = $true
$config.Output.Verbosity = if ($CI) { "Normal" } else { "Detailed" }

if ($CI) {
    $config.TestResult.Enabled = $true
    $config.TestResult.OutputPath = Join-Path $PSScriptRoot "resultados.xml"
    $config.TestResult.OutputFormat = "NUnitXml"
}

$resultado = Invoke-Pester -Configuration $config

Write-Host ""
Write-Host "=================================================="
Write-Host "Total: $($resultado.TotalCount)  Pasaron: $($resultado.PassedCount)  Fallaron: $($resultado.FailedCount)  Saltados: $($resultado.SkippedCount)"
Write-Host "=================================================="

if ($resultado.FailedCount -gt 0) {
    exit 1
}
exit 0
