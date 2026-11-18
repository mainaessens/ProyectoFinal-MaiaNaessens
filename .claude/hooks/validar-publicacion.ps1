<#
.SYNOPSIS
    Hook PreToolUse: bloquea cualquier llamada de publicacion (Instagram) si no
    existe un .plan.json aprobado para esa pieza.

.DESCRIPTION
    Claude Code invoca los hooks PreToolUse pasando por stdin un JSON con, entre otros campos,
    tool_name y tool_input. Este script:
      1. Lee ese JSON de stdin.
      2. Si el tool_name no es de publicacion, permite la llamada sin mas (exit 0).
      3. Si lo es, EXIGE que tool_input incluya "cliente" - sin eso, bloquea (no se puede
         verificar aprobacion para un cliente no identificado).
      4. Busca en clientes/<cliente>/historial/*.plan.json (SOLO la carpeta de ESE cliente,
         nunca de otros) un plan con "aprobado": true.
      5. Si no encuentra un plan aprobado para ese cliente puntual, BLOQUEA (exit code 2).
      6. Si lo encuentra, permite la llamada (exit 0).

    Registrado en settings.json bajo hooks.PreToolUse con matcher sobre las tools de
    publicacion (ver .claude/settings.json).
#>

$ErrorActionPreference = "Stop"

$inputJson = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputJson)) {
    # Sin input valido: por seguridad, no se bloquea, pero se avisa (falla "abierta" en modo test).
    Write-Host "validar-publicacion: no se recibio input por stdin, nada que validar."
    exit 0
}

$data = $inputJson | ConvertFrom-Json

$toolName = $data.tool_name
$publicacionPattern = "mcp__instagram__(publicar|subir)"

if ($toolName -notmatch $publicacionPattern) {
    # No es una tool de publicacion: no aplica este hook.
    exit 0
}

$cliente = $data.tool_input.cliente

if ([string]::IsNullOrWhiteSpace($cliente)) {
    $mensaje = "BLOQUEADO por validar-publicacion.ps1: la herramienta '$toolName' intenta " +
        "publicar pero tool_input no incluye 'cliente' - no se puede verificar " +
        "aprobacion para un cliente no identificado."
    [Console]::Error.WriteLine($mensaje)
    exit 2
}

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$historialCliente = Join-Path $agenciaRoot "clientes\$cliente\historial"

$planesEncontrados = Get-ChildItem -Path $historialCliente -Filter "*.plan.json" -ErrorAction SilentlyContinue

$planAprobado = $null
foreach ($archivo in $planesEncontrados) {
    try {
        $plan = Get-Content -Raw -Path $archivo.FullName | ConvertFrom-Json
        if ($plan.aprobado -eq $true) {
            $planAprobado = $archivo
            break
        }
    } catch {
        continue
    }
}

if (-not $planAprobado) {
    $mensaje = "BLOQUEADO por validar-publicacion.ps1: la herramienta '$toolName' intenta " +
        "publicar para el cliente '$cliente', pero no se encontro ningun archivo " +
        "`"aprobado`": true en clientes/$cliente/historial/. Presenta la propuesta al usuario " +
        "y espera su OK explicito antes de reintentar."
    [Console]::Error.WriteLine($mensaje)
    exit 2
}

Write-Host "validar-publicacion: OK, plan aprobado encontrado en $($planAprobado.FullName)."
exit 0
