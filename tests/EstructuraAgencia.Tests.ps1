#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
Tests estructurales (no de comportamiento del LLM): validan que la configuracion base de
.claude/ este completa y bien formada, y que cada skill tenga el frontmatter minimo requerido
para que Claude Code lo reconozca como comando.
#>

BeforeDiscovery {
    $discoAgenciaRoot = Split-Path -Parent $PSScriptRoot
    $discoClaudeDir = Join-Path $discoAgenciaRoot ".claude"
    $script:SkillFiles = @(Get-ChildItem -Path (Join-Path $discoClaudeDir "skills") -Filter "SKILL.md" -Recurse)
    $script:AgentFiles = @(Get-ChildItem -Path (Join-Path $discoClaudeDir "agents") -Filter "*.md")
    $script:PsFiles = @(Get-ChildItem -Path (Join-Path $discoClaudeDir "hooks") -Filter "*.ps1") +
                       @(Get-ChildItem -Path (Join-Path $discoClaudeDir "scripts") -Filter "*.ps1")
}

BeforeAll {
    $script:AgenciaRoot = Split-Path -Parent $PSScriptRoot
    $script:ClaudeDir = Join-Path $AgenciaRoot ".claude"

    function Get-Frontmatter([string]$Path) {
        $content = Get-Content -Raw -Path $Path
        if ($content -match '(?s)^---\r?\n(.*?)\r?\n---') {
            return $Matches[1]
        }
        return $null
    }
}

Describe "Estructura base de .claude/" {

    It "CLAUDE.md existe" {
        Test-Path (Join-Path $ClaudeDir "CLAUDE.md") | Should -BeTrue
    }

    It "settings.json existe y es JSON valido" {
        $path = Join-Path $ClaudeDir "settings.json"
        Test-Path $path | Should -BeTrue
        { Get-Content -Raw $path | ConvertFrom-Json } | Should -Not -Throw
    }

    It ".env.example existe y no contiene valores reales (solo placeholders vacios)" {
        $path = Join-Path $ClaudeDir ".env.example"
        Test-Path $path | Should -BeTrue
        $lines = Get-Content $path | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" }
        foreach ($line in $lines) {
            $valor = ($line -split "=", 2)[1]
            $valor | Should -BeNullOrEmpty
        }
    }

    It "clientes/plantilla/perfil.md existe" {
        Test-Path (Join-Path $AgenciaRoot "clientes\plantilla\perfil.md") | Should -BeTrue
    }
}

Describe "Skills - frontmatter valido" {

    BeforeAll {
        $script:SkillFiles = Get-ChildItem -Path (Join-Path $ClaudeDir "skills") -Filter "SKILL.md" -Recurse
    }

    It "existe al menos un skill" {
        $SkillFiles.Count | Should -BeGreaterThan 0
    }

    It "cada SKILL.md tiene bloque frontmatter (---...---)" -ForEach $SkillFiles {
        $fm = Get-Frontmatter $_.FullName
        $fm | Should -Not -BeNullOrEmpty
    }

    It "cada SKILL.md declara 'name'" -ForEach $SkillFiles {
        $fm = Get-Frontmatter $_.FullName
        $fm | Should -Match "name:\s*\S+"
    }

    It "cada SKILL.md declara 'description'" -ForEach $SkillFiles {
        $fm = Get-Frontmatter $_.FullName
        $fm | Should -Match "description:\s*\S+"
    }

    It "el 'name' del frontmatter coincide con el nombre de la carpeta" -ForEach $SkillFiles {
        $fm = Get-Frontmatter $_.FullName
        if ($fm -match "name:\s*(\S+)") {
            $nombreDeclarado = $Matches[1].Trim()
            $nombreCarpeta = Split-Path -Leaf (Split-Path -Parent $_.FullName)
            $nombreDeclarado | Should -Be $nombreCarpeta
        }
    }
}

Describe "Subagentes - frontmatter valido" {

    BeforeAll {
        $script:AgentFiles = Get-ChildItem -Path (Join-Path $ClaudeDir "agents") -Filter "*.md"
    }

    It "existe al menos un subagente" {
        $AgentFiles.Count | Should -BeGreaterThan 0
    }

    It "cada agente tiene bloque frontmatter" -ForEach $AgentFiles {
        $fm = Get-Frontmatter $_.FullName
        $fm | Should -Not -BeNullOrEmpty
    }

    It "cada agente declara 'tools'" -ForEach $AgentFiles {
        $fm = Get-Frontmatter $_.FullName
        $fm | Should -Match "tools:\s*\S+"
    }
}

Describe "Scripts y hooks - sintaxis PowerShell valida" {

    BeforeAll {
        $script:PsFiles = @(Get-ChildItem -Path (Join-Path $ClaudeDir "hooks") -Filter "*.ps1") +
                           @(Get-ChildItem -Path (Join-Path $ClaudeDir "scripts") -Filter "*.ps1")
    }

    It "existe al menos un script .ps1" {
        $PsFiles.Count | Should -BeGreaterThan 0
    }

    It "parsea sin errores de sintaxis" -ForEach $PsFiles {
        $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$null, [ref]$errors) | Out-Null
        $errors.Count | Should -Be 0
    }
}
