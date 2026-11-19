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
├── mcp/instagram-publisher/        # conector propio de Instagram: publicación (imagen, carrusel, reel, historias) y estadísticas (Node, sin dependencias)
├── herramientas/marca/             # motor de diseño con código (Claude Design): kit de marca, piezas HTML, lint y render a PNG
├── herramientas/moviola/           # editor de video local (Node + FFmpeg + Whisper): cortes, subtítulos, títulos, plan aprobable
├── ui/                             # Postagent: panel web (React + Express + WebSocket) para operar el agente
├── tests/                          # suite de tests automatizados (Pester + Node) — ver tests/README.md
└── docs/                           # documentación técnica — ver "Documentación"
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
├── .mcp.json                       # conectores MCP declarados (Drive, Calendar, Canva,
│                                    #   Instagram propio, Glif) — solo referencias a env vars
├── .env.example                    # variables de entorno necesarias, sin valores reales
├── instagram-cuentas.json          # cliente → ig_user_id (no es un secreto)
│
├── agents/                         # SUBAGENTES — especialistas invocados por los skills
│   ├── estratega.md                #   campaña mensual, tendencias (WebSearch), calendario editorial
│   ├── disenador.md                #   piezas gráficas: prioridad foto real → Canva → Glif (Fase 6)
│   ├── community-manager.md        #   analiza las estadísticas de IG cada mes; adapta captions, arma el PLAN
│   ├── editor-video.md             #   edita el video en bruto con Moviola (director, editor, crítico)
│   └── horario-optimo.md           #   sugiere horario óptimo (Calendar + histórico de la cuenta)
│
├── skills/                         # SKILLS — procedimientos invocables como /comando
│   ├── nuevo-cliente/SKILL.md      #   alta: ordena el Drive (con OK), descarga assets, plantillas Canva, perfil
│   ├── analisis-cuenta/SKILL.md    #   estadísticas reales de Instagram (community-manager) → decisiones para el plan
│   ├── plan-del-dia/SKILL.md       #   Calendar + estado del calendario editorial, prioridades del día
│   ├── crear-post/SKILL.md         #   por número/slug/todos: caption + diseño + export → PLAN aprobado → Instagram
│   ├── crear-historias/SKILL.md    #   secuencia de historias → plan → publicación por API (sin stickers)
│   ├── editar-video/SKILL.md       #   edita el bruto del cliente → plan escena por escena → video terminado
│   ├── crear-reel/SKILL.md         #   guion + video real del cliente + portada Canva → PLAN
│   ├── campania-mensual/SKILL.md   #   tendencias + historial → calendario editorial del mes
│   ├── reporte-semanal/SKILL.md    #   informe semanal de actividad (sin inventar métricas)
│   └── cierre-mensual/SKILL.md     #   consolida el mes → actualiza aprendizajes.md de la cuenta
│
├── referencias/                    # método del community-manager: criterios editoriales, guía de
│                                    #   reels/carruseles/historias, autoevaluación de piezas
│
├── hooks/                          # RED DE SEGURIDAD técnica (no negociable)
│   ├── validar-publicacion.ps1     #   PreToolUse: bloquea publicar sin plan aprobado del cliente
│   │                                #   exacto y gastar sin monto aprobado, tope y campaña en pausa
│   └── registrar-actividad.ps1     #   PostToolUse: registra toda acción relevante en el log
│                                    #   de auditoría del cliente correspondiente
│
└── scripts/                        # utilitarios de soporte (PowerShell)
    ├── descargar-assets.ps1        #   sincroniza fotos/videos/identidad desde Drive (ver docs/orden-del-drive.md)
    └── checklist-marca.ps1         #   valida un texto contra las restricciones del perfil
```

`.claude/` define el **cómo** (procedimientos y controles, igual para todas las cuentas).
`clientes/` define el **quién** (datos y memoria de cada cuenta). Añadir un cliente nuevo nunca
requiere modificar nada dentro de `.claude/`.

## Cómo empezar

1. Abrir esta carpeta (`agencia/`) con Claude Code.
2. Copiar `.claude/.env.example` a `.claude/.env` y completar las variables a medida que se
   activen los conectores de cada fase. `.claude/.env` está ignorado por git, el código lo
   carga solo y es la única fuente de estas variables (no se usa el entorno del sistema).
3. Dar de alta un cliente: `/nuevo-cliente <nombre> [url-drive]`.

## Roadmap

El sistema se construye en fases iterativas, cada una añadiendo un solo conector o capacidad nueva.
El detalle de cada fase está en el PDF del plan y en las historias del proyecto Jira **PFMGN**.

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md): componentes, modelo de datos, barreras de seguridad,
  variables de entorno, decisiones y limitaciones.
- [`docs/flujo-de-trabajo.md`](docs/flujo-de-trabajo.md): recorrido de un cliente, con cada parada humana.
- [`docs/obtencion-de-credenciales.md`](docs/obtencion-de-credenciales.md): paso a paso para conseguir cada
  API y token (Meta, Glif, Vercel Blob, conectores), con los errores encontrados y su solución.
- [`docs/conectar-instagram.md`](docs/conectar-instagram.md): conector de publicación, tokens y pruebas.
- [`docs/fases-1-y-6.md`](docs/fases-1-y-6.md): estado de Glif y publicación.
- [`docs/fase5-canva.md`](docs/fase5-canva.md), [`docs/mvp-fase-0-4.md`](docs/mvp-fase-0-4.md),
  [`docs/guia-testeo-manual.md`](docs/guia-testeo-manual.md): fases anteriores y guía de pruebas.

## Estado actual (2026-11-04)

- **Fases 0 a 5 funcionando**: alta de cliente con Drive, campaña mensual, creación de piezas en Canva
  con exportación y planes aprobados.
- **Fase 1 (publicación)**: conector propio de Instagram con imagen, carrusel y reel; lectura verificada
  contra Meta real y **primera publicación real (carrusel) verificada el 2026-11-04**.
- **Fase 6** (Glif): verificada contra el servicio real (una imagen con `compose_project`).
- **Pruebas**: suite Pester (hooks, scripts, estructura, esquema de planes) + tests de Node del conector.
- Jira (proyecto **PFMGN**) se usa solo para trackear la tesis; el epic **PFMGN-71** es la interfaz
  web (fuera de este roadmap).
