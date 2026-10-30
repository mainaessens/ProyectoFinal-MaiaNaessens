<#
.SYNOPSIS
    Hook PreToolUse: bloquea cualquier llamada de publicacion (Late/Postiz) o de gasto
    (Meta Ads crear/editar) si no existe un .plan.json aprobado para esa pieza.

.DESCRIPTION
    Claude Code invoca los hooks PreToolUse pasando por stdin un JSON con, entre otros campos,
    tool_name y tool_input. Este script:
      1. Lee ese JSON de stdin.
      2. Si el tool_name no es de publicacion/gasto, permite la llamada sin mas (exit 0).
      3. Si lo es, EXIGE que tool_input incluya "cliente" - sin eso, bloquea (no se puede
         verificar aprobacion para un cliente no identificado).
      4. Busca en clientes/<cliente>/historial/*.plan.json (SOLO la carpeta de ESE cliente,
         nunca de otros) un plan con "aprobado": true.
      5. Si no encuentra un plan aprobado para ese cliente puntual, BLOQUEA (exit code 2).
      6. Si lo encuentra, permite la llamada (exit 0).

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
$publicacionPattern = "mcp__postiz__|mcp__late__|mcp__instagram__(publicar|subir)"
$gastoPattern = "mcp__meta-ads__create|mcp__meta-ads__update"

if ($toolName -notmatch $publicacionPattern -and $toolName -notmatch $gastoPattern) {
    # No es una tool de publicacion ni de gasto: no aplica este hook.
    exit 0
}

$cliente = $data.tool_input.cliente

if ([string]::IsNullOrWhiteSpace($cliente)) {
    $mensaje = "BLOQUEADO por validar-publicacion.ps1: la herramienta '$toolName' intenta " +
        "publicar/gastar pero tool_input no incluye 'cliente' - no se puede verificar " +
        "aprobacion para un cliente no identificado."
    [Console]::Error.WriteLine($mensaje)
    exit 2
}

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$historialCliente = Join-Path $agenciaRoot "clientes\$cliente\historial"

function Block([string]$msg) {
    [Console]::Error.WriteLine("BLOQUEADO por validar-publicacion.ps1: $msg")
    exit 2
}

# --- v2: GASTO (Meta Ads). Exige su propia aprobacion (*.ads.json) con monto exacto, tope mensual
# --- y campania en pausa. Un plan de publicacion aprobado NO habilita gasto.
if ($toolName -match $gastoPattern) {
    if ($cliente -notmatch '^[a-z0-9][a-z0-9\-]*$') {
        Block "nombre de cliente invalido '$cliente' para una llamada de gasto."
    }

    $limitesPath = if ($env:AGENCIA_LIMITES_PATH) { $env:AGENCIA_LIMITES_PATH } else { Join-Path $agenciaRoot ".claude\limites.json" }
    if (-not (Test-Path $limitesPath)) { Block "no existe limites.json: no hay tope de gasto configurado." }
    $limites = Get-Content -Raw -Path $limitesPath | ConvertFrom-Json
    $limCliente = $limites.clientes.$cliente
    if ($null -eq $limCliente -or $null -eq $limCliente.tope_mensual -or [double]$limCliente.tope_mensual -le 0) {
        Block "el cliente '$cliente' no tiene un tope_mensual > 0 en limites.json."
    }
    $tope = [double]$limCliente.tope_mensual

    $aprobaciones = @()
    foreach ($a in (Get-ChildItem -Path $historialCliente -Filter "*.ads.json" -ErrorAction SilentlyContinue)) {
        try {
            $obj = Get-Content -Raw -Path $a.FullName | ConvertFrom-Json
            if ($obj.aprobado -eq $true -and [double]$obj.monto_confirmado -gt 0) { $aprobaciones += $obj }
        } catch { continue }
    }
    if ($aprobaciones.Count -eq 0) {
        Block "no hay aprobacion de gasto (*.ads.json con aprobado:true y monto_confirmado) para '$cliente'."
    }

    $mesActual = (Get-Date).ToString("yyyy-MM")
    $gastadoMes = ($aprobaciones | Where-Object { "$($_.fecha_aprobacion)".StartsWith($mesActual) } |
        Measure-Object -Property monto_confirmado -Sum).Sum
    if ($gastadoMes -gt $tope) {
        Block "las aprobaciones de $mesActual suman $gastadoMes, por encima del tope mensual $tope de '$cliente'."
    }

    # Monto de la llamada (Meta usa centavos en daily_budget/lifetime_budget; 'monto' va en unidades).
    $ti = $data.tool_input
    $montoLlamada = $null
    if ($null -ne $ti.monto) { $montoLlamada = [double]$ti.monto }
    elseif ($null -ne $ti.lifetime_budget) { $montoLlamada = [double]$ti.lifetime_budget / 100 }
    elseif ($null -ne $ti.daily_budget) { $montoLlamada = 0 }  # se resuelve con duracion abajo

    $ok = $false
    foreach ($ap in $aprobaciones) {
        $conf = [double]$ap.monto_confirmado
        $monto = $montoLlamada
        if ($null -ne $ti.daily_budget -and $null -eq $ti.monto -and $null -eq $ti.lifetime_budget) {
            $dias = if ($ap.duracion_dias) { [double]$ap.duracion_dias } else { 0 }
            $monto = ([double]$ti.daily_budget / 100) * $dias
            if ($dias -le 0) { continue }
        }
        if ($null -eq $monto -or $monto -le $conf) { $ok = $true; $apOk = $ap; break }
    }
    if (-not $ok) { Block "el monto de la llamada supera el monto_confirmado de toda aprobacion vigente de '$cliente'." }

    $status = "$($ti.status)".ToUpper()
    if ($toolName -match "create" -and $status -and $status -ne "PAUSED") {
        Block "las campanas se crean siempre en pausa (status=PAUSED); recibido '$status'."
    }
    if ($status -eq "ACTIVE" -and $apOk.activacion_confirmada -ne $true) {
        Block "activar una campana requiere segunda confirmacion (activacion_confirmada:true en la aprobacion)."
    }

    Write-Host "validar-publicacion: OK gasto, aprobacion de $($apOk.monto_confirmado) encontrada (mes ${mesActual}: $gastadoMes de $tope)."
    exit 0
}

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
        "publicar/gastar para el cliente '$cliente', pero no se encontro ningun archivo " +
        "`"aprobado`": true en clientes/$cliente/historial/. Presenta la propuesta al usuario " +
        "y espera su OK explicito antes de reintentar."
    [Console]::Error.WriteLine($mensaje)
    exit 2
}

Write-Host "validar-publicacion: OK, plan aprobado encontrado en $($planAprobado.FullName)."
exit 0
