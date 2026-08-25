# Agente de inteligencia artificial para el análisis de cuentas profesionales en redes sociales y la generación asistida de planes de contenido

Proyecto final de Ingeniería en Informática (FACET-UNT). Agente de IA construido sobre Claude
Code que analiza la presencia en redes sociales de una cuenta profesional y genera, de forma
asistida y con control humano en cada paso, planes de contenido mensuales y apoyo creativo para
las piezas. Ver el Plan de Trabajo oficial en `Documentos/2. Plan de Trabajo - Naessens, Maia
Guadalupe.pdf` y el tablero de historias en Jira (proyecto **PFMGN**).

## Principio rector

**Human-in-the-loop**: el agente nunca publica, crea tareas en bloque ni gasta dinero sin
presentar antes la propuesta y recibir un OK explícito. Ver la regla completa en
[`.claude/CLAUDE.md`](.claude/CLAUDE.md).

## Estructura

```
agencia/
├── .claude/          # configuración: reglas, conectores MCP, subagentes, skills, hooks
├── clientes/         # memoria local por cuenta de cliente
│   └── plantilla/    # copiar esta carpeta para dar de alta un cliente nuevo
├── tests/            # suite de tests automatizados (Pester) — ver tests/README.md
└── docs/             # documentación de arquitectura por fase
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

Fases 0 a 4 completas y validadas (ver [`docs/mvp-fase-0-4.md`](docs/mvp-fase-0-4.md)). Fase 5
(diseño con Canva) construida en modo plan — ver [`docs/fase5-canva.md`](docs/fase5-canva.md);
bloqueada para funcionar de punta a punta hasta conectar una cuenta real de Canva y diseñar las
plantillas maestras. Ver el tablero de Jira (proyecto **PFMGN**) para el estado historia por
historia, y el epic **PFMGN-71** para la interfaz web (fuera de este roadmap, sin planificar
todavía).
