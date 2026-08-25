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
├── .claude/                        # configuración del agente — ver detalle abajo
├── clientes/                       # memoria local por cuenta de cliente
│   └── plantilla/                  # copiar esta carpeta para dar de alta un cliente nuevo
├── tests/                          # suite de tests automatizados (Pester) — ver tests/README.md
└── docs/                           # documentación de arquitectura por fase
```

### `.claude/` — la carpeta más importante del proyecto

Define **todo** el comportamiento del agente: reglas, conectores, subagentes, procedimientos y
controles de seguridad. Es lo que hace que el sistema funcione igual para cualquier cliente sin
tocar código.

```
.claude/
├── CLAUDE.md                       # reglas globales: regla de oro human-in-the-loop,
│                                    #   convenciones de idioma/nomenclatura, ciclo de estados
├── settings.json                   # permisos y registro de hooks (PreToolUse/PostToolUse)
├── .mcp.json                       # conectores MCP declarados (Drive, Calendar, Jira, Canva,
│                                    #   Late/Postiz pendiente) — solo referencias a env vars
├── .env.example                    # variables de entorno necesarias, sin valores reales
│
├── agents/                         # SUBAGENTES — especialistas invocados por los skills
│   ├── estratega.md                #   campaña mensual, tendencias (WebSearch), calendario editorial
│   ├── disenador.md                #   piezas gráficas: prioridad foto real → Canva → Glif (Fase 6)
│   ├── community-manager.md        #   adapta captions por red (IG/FB), arma el PLAN de publicación
│   └── horario-optimo.md           #   sugiere horario óptimo (Calendar + histórico de la cuenta)
│
├── skills/                         # SKILLS — procedimientos invocables como /comando
│   ├── nuevo-cliente/SKILL.md      #   alta de cliente + lectura automática de brief/manual (Drive)
│   ├── plan-del-dia/SKILL.md       #   vista unificada Calendar + Jira, prioridades del día
│   ├── crear-post/SKILL.md         #   hook + caption + diseño + horario → PLAN aprobado
│   ├── campania-mensual/SKILL.md   #   tendencias + historial → calendario editorial del mes
│   ├── reporte-semanal/SKILL.md    #   informe semanal de actividad (sin inventar métricas)
│   └── cierre-mensual/SKILL.md     #   consolida el mes → actualiza aprendizajes.md de la cuenta
│
├── hooks/                          # RED DE SEGURIDAD técnica (no negociable)
│   ├── validar-publicacion.ps1     #   PreToolUse: bloquea publicar/gastar sin plan aprobado
│   │                                #   del cliente exacto de la operación (probado con Pester)
│   └── registrar-actividad.ps1     #   PostToolUse: registra toda acción relevante en el log
│                                    #   de auditoría del cliente correspondiente
│
└── scripts/                        # utilitarios de soporte (PowerShell)
    ├── descargar-assets.ps1        #   sincroniza fotos/videos del cliente desde Drive
    └── checklist-marca.ps1         #   valida un texto contra las restricciones del perfil
```

`.claude/` define el **cómo** (procedimientos y controles, igual para todas las cuentas).
`clientes/` define el **quién** (datos y memoria de cada cuenta). Añadir un cliente nuevo nunca
requiere modificar nada dentro de `.claude/`.

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
