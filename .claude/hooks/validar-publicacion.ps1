<#
.SYNOPSIS
    Hook PreToolUse: bloquea cualquier llamada de publicacion (Late/Postiz) o de gasto
    (Meta Ads crear/editar) si no existe un .plan.json aprobado para esa pieza.

.DESCRIPTION
    Claude Code invoca los hooks PreToolUse pasando por stdin un JSON con, entre otros campos,
    tool_name y tool_input. Este script:
      1. Lee ese JSON de stdin.
      2. Si el tool_name no es de publicacion/gasto, permite la llamada sin mas (exit 0).
      3. Si lo es, busca en clientes/*/historial/*.plan.json un plan que coincida (por cliente
         y contenido) y tenga "aprobado": true.
      4. Si no encuentra un plan aprobado, BLOQUEA la llamada (exit code 2) y explica por que.
      5. Si lo encuentra, permite la llamada (exit 0).

    Registrado en settings.json bajo hooks.PreToolUse con matcher sobre las tools de
    publicacion/gasto (ver .claude/settings.json).

.NOTES
    v1 (Fase 1): valida solo publicaciones (Late/Postiz).
    v2 (Fase 8): se extiende para validar tambien el monto exacto en llamadas de Meta Ads.
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
$publicacionPattern = "mcp__postiz__|mcp__late__"
$gastoPattern = "mcp__meta-ads__create|mcp__meta-ads__update"

if ($toolName -notmatch $publicacionPattern -and $toolName -notmatch $gastoPattern) {
    # No es una tool de publicacion ni de gasto: no aplica este hook.
    exit 0
}

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$planesEncontrados = Get-ChildItem -Path (Join-Path $agenciaRoot "clientes") -Recurse -Filter "*.plan.json" -ErrorAction SilentlyContinue

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
        "publicar/gastar, pero no se encontro ningun archivo .plan.json con `"aprobado`": true " +
        "en clientes/*/historial/. Presenta la propuesta al usuario y espera su OK explicito " +
        "antes de reintentar."
    [Console]::Error.WriteLine($mensaje)
    exit 2
}

Write-Host "validar-publicacion: OK, plan aprobado encontrado en $($planAprobado.FullName)."
exit 0
