<#
.SYNOPSIS
    Hook PostToolUse: registra en clientes/<cliente>/registro-actividad.log toda llamada de
    publicacion o cambio de estado en Jira ya ejecutada.

.DESCRIPTION
    Claude Code invoca los hooks PostToolUse pasando por stdin un JSON con tool_name,
    tool_input y tool_response. Este script:
      1. Lee ese JSON de stdin.
      2. Si la tool no es relevante para auditoria (publicacion/Jira), no hace nada.
      3. Si lo es, intenta identificar a que cliente corresponde (por convencion, el tool_input
         suele incluir una referencia al cliente o al plan; si no se puede determinar, se anota
         en un log general).
      4. Agrega una linea con fecha, hora, herramienta usada, y un resumen del resultado.

    Registrado en settings.json bajo hooks.PostToolUse (ver .claude/settings.json).
#>

$ErrorActionPreference = "Stop"

$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) { exit 0 }

$data = $inputJson | ConvertFrom-Json
$toolName = $data.tool_name

$patronRelevante = "mcp__instagram__(publicar|subir)|mcp__atlassian__"
if ($toolName -notmatch $patronRelevante) { exit 0 }

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fecha = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Intenta extraer un nombre de cliente del tool_input (convencion: campo "cliente" o "project").
$cliente = $null
if ($data.tool_input.cliente) { $cliente = $data.tool_input.cliente }
elseif ($data.tool_input.project) { $cliente = $data.tool_input.project }

$linea = "[$fecha] tool=$toolName"
if ($cliente) { $linea += " cliente=$cliente" }

if ($cliente) {
    $logPath = Join-Path $agenciaRoot "clientes\$cliente\registro-actividad.log"
    if (Test-Path (Split-Path $logPath)) {
        Add-Content -Path $logPath -Value $linea -Encoding UTF8
        exit 0
    }
}

# Sin cliente identificable o carpeta inexistente: log general de la agencia.
$logGeneral = Join-Path $agenciaRoot ".claude\registro-actividad-general.log"
Add-Content -Path $logGeneral -Value $linea -Encoding UTF8
exit 0
