# Agente de inteligencia artificial para el análisis de cuentas profesionales en redes sociales y la generación asistida de planes de contenido

Sistema de automatización de marketing para agencia, construido íntegramente sobre Claude Code
(sin desarrollar ninguna app propia). Ver el plan completo en
`Documentos/Plan_Agencia_Marketing_Claude.pdf` y el tablero de historias en Jira (proyecto
**PFMGN**).

## Principio rector

**Human-in-the-loop**: el agente nunca publica, crea tareas en bloque ni gasta dinero sin
presentar antes la propuesta y recibir un OK explícito. Ver la regla completa en
[`.claude/CLAUDE.md`](.claude/CLAUDE.md).

## Estructura

```
agencia/
├── .claude/          # configuración: reglas, conectores MCP, subagentes, skills, hooks
└── clientes/         # memoria local por cuenta de cliente
    └── plantilla/    # copiar esta carpeta para dar de alta un cliente nuevo
```

## Cómo empezar

1. Abrir esta carpeta (`agencia/`) con Claude Code.
2. Copiar variables de `. claude/.env.example` a variables de entorno del sistema (nunca a un
   archivo versionado) a medida que se activen los conectores de cada fase.
3. Dar de alta un cliente: `/nuevo-cliente <nombre> [url-drive]`.

## Roadmap

El sistema se construye en 9 fases iterativas (Fase 0 a Fase 8), cada una añadiendo un solo
conector o capacidad nueva, con la fase de gasto real (creación de campañas Meta Ads) al final.
El detalle de cada fase está en el PDF del plan y en las historias del proyecto Jira **PFMGN**.

## Estado actual

Fase 0 (base local) en construcción — ver tablero de Jira para el estado historia por historia.
