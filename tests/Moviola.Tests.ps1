#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Editor de video (Moviola): corre los tests de Node del toolkit (cortes, subtitulos, plan de
edicion, argumentos de FFmpeg y la barrera que impide exportar sin aprobacion). No requiere
FFmpeg ni Whisper instalados: esas partes se verifican con una prueba de punta a punta aparte.
#>

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
}

Describe "Moviola (editor de video)" {

    It "los tests de Node del toolkit pasan" -Skip:(-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Push-Location $AgenciaRoot
        try {
            $out = & node --test "herramientas/moviola/moviola.test.mjs" 2>&1 | Out-String
            $LASTEXITCODE | Should -Be 0 -Because $out
        } finally { Pop-Location }
    }

    It "el skill /editar-video y el agente editor-video existen" {
        Test-Path (Join-Path $AgenciaRoot ".claude\skills\editar-video\SKILL.md") | Should -BeTrue
        Test-Path (Join-Path $AgenciaRoot ".claude\agents\editor-video.md") | Should -BeTrue
    }
}
