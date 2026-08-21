<#
.SYNOPSIS
    Valida un texto (caption/propuesta) contra las restricciones definidas en el perfil.md
    de un cliente, y genera warnings si detecta posibles violaciones.

.DESCRIPTION
    Chequeo mecanico simple (no reemplaza el criterio del agente ni del humano): busca en el
    texto a validar palabras o patrones que coincidan con la seccion "Restricciones - que NO
    publicar" del perfil.md del cliente, y devuelve una lista de advertencias.

    Se invoca como parte del hook validar-publicacion.ps1 (Fase 1) y de los skills
    /crear-post y /crear-reel, antes de mostrarle la pieza al humano para aprobacion.

.PARAMETER Cliente
    Nombre de la carpeta del cliente en clientes/<nombre>/.

.PARAMETER TextoPath
    Ruta a un archivo de texto con el caption/copy a validar.

.PARAMETER Texto
    Texto a validar, si no se pasa -TextoPath.

.EXAMPLE
    ./checklist-marca.ps1 -Cliente cafe-lunar -Texto "El mejor cold brew a 500 pesos..."
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Cliente,

    [string]$TextoPath,

    [string]$Texto
)

$ErrorActionPreference = "Stop"

$agenciaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$perfilPath = Join-Path $agenciaRoot "clientes\$Cliente\perfil.md"

if (-not (Test-Path $perfilPath)) {
    throw "No existe perfil.md para '$Cliente' en clientes/$Cliente/perfil.md"
}

if ($TextoPath) {
    if (-not (Test-Path $TextoPath)) { throw "No existe el archivo $TextoPath" }
    $Texto = Get-Content -Raw -Path $TextoPath
}
if (-not $Texto) {
    throw "Pasa -Texto o -TextoPath con el contenido a validar."
}

$perfil = Get-Content -Raw -Encoding UTF8 -Path $perfilPath

# Extraer la seccion "Restricciones" del perfil.md
$restriccionesMatch = [regex]::Match(
    $perfil,
    "## Restricciones.*?\n(.*?)(\n## |\z)",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$warnings = New-Object System.Collections.Generic.List[string]

if ($restriccionesMatch.Success) {
    $restriccionesTexto = $restriccionesMatch.Groups[1].Value
    $items = [regex]::Matches($restriccionesTexto, "^\s*-\s*(.+)$", "Multiline")

    foreach ($item in $items) {
        $regla = $item.Groups[1].Value.Trim()
        if ([string]::IsNullOrWhiteSpace($regla) -or $regla.StartsWith("(")) { continue }

        # Chequeo heuristico: precios (numero seguido de "pesos"/"$"/moneda).
        if ($regla -match "precio" -and $Texto -match '(\$\s?\d|\d+\s?(pesos|usd|ars))') {
            $warnings.Add("Posible violacion: el texto menciona un precio y el perfil restringe: '$regla'")
        }

        # Palabras clave sueltas de 5+ letras dentro de la regla, buscadas literalmente en el texto (sin distincion de mayusculas/acentos).
        $palabrasClave = [regex]::Matches($regla, "[\p{L}]{5,}") | ForEach-Object { $_.Value }
        foreach ($palabra in $palabrasClave) {
            if ($Texto -match [regex]::Escape($palabra)) {
                $warnings.Add("Posible violacion: el texto contiene '$palabra', relacionado con la restriccion: '$regla'")
            }
        }
    }
} else {
    $warnings.Add("No se encontro la seccion 'Restricciones' en perfil.md - revisar manualmente.")
}

if ($warnings.Count -eq 0) {
    Write-Host "OK - Checklist de marca: sin violaciones detectadas contra perfil.md de '$Cliente'."
    exit 0
} else {
    Write-Host "ALERTA - Checklist de marca: se detectaron $($warnings.Count) posible(s) violacion(es):"
    foreach ($w in $warnings) { Write-Host "  - $w" }
    Write-Host ""
    Write-Host "Esto NO bloquea automaticamente la publicacion - es una alerta para que el humano revise antes de aprobar."
    exit 1
}
