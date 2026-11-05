# Arquitectura técnica

Agente de automatización para la gestión de contenido de cuentas profesionales, construido sobre
Claude Code. No hay aplicación propia: el comportamiento vive en la carpeta `.claude/`
(instrucciones, subagentes, hooks) más un conector propio de publicación en `mcp/`.

## 1. Visión general

```
                         ┌───────────────────────── Claude Code (orquestador) ─────────────────────────┐
 Google Drive ──────────►│  skills (/comando)  ──►  subagentes  ──►  conectores MCP                     │
 (brief, manual, assets) │      │                        │                 │                            │
                         │      ▼                        ▼                 ▼                            │
 Canva (diseño) ◄───────►│  hooks PreToolUse/PostToolUse        Instagram (conector propio, Graph API)  │
 Glif (imágenes IA)      │  (validan y auditan)                 Vercel Blob (URL pública de la imagen)  │
 Atlassian (Jira, tesis) │                                      Meta Ads (solo con aprobación + tope)   │
                         └──────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                        clientes/<cliente>/  (memoria local: perfil, calendario, planes, assets, log)
```

Principio rector: **proponer → revisar → ejecutar**. Nada se publica, se carga en bloque ni se
gasta sin un OK explícito del humano, y esa regla se hace cumplir con barreras técnicas (sección 5).

## 2. Componentes

### Skills (`.claude/skills/<nombre>/SKILL.md`)
| Skill | Qué hace |
|---|---|
| `/nuevo-cliente` | Lee el Drive del cliente, propone y (con OK) aplica un orden de carpetas, descarga fotos/videos, genera `perfil.md`, deja las 3 plantillas maestras de Canva (del Drive, o generadas con Canva / Claude Design). |
| `/campania-mensual` | Tendencias (WebSearch) + historial → tabla numerada del mes; con aprobación, crea tareas/eventos y ofrece seguir con `/crear-post`. |
| `/crear-post` | Por número, slug o `todos`: hook, caption por red, diseño en Canva, revisión, exportación a `assets/exports/`, `.plan.json` aprobado y publicación opcional en Instagram. |
| `/crear-reel` | Guion, selección del video real del cliente, portada en Canva, plan. Nunca inventa video. |
| `/plan-del-dia` | Vista unificada de Calendar + Jira. Solo lectura. |
| `/reporte-semanal`, `/cierre-mensual` | Informe semanal y memoria mensual (`historial/`, `aprendizajes.md`). |
| `/lanzar-campania-ads` | Campaña de Meta Ads con doble confirmación; se crea en pausa. |

### Subagentes (`.claude/agents/`)
`estratega` (campaña y tendencias), `disenador` (piezas gráficas; prioridad foto real → plantilla
Canva sin foto → imagen IA con máximo 2 variantes), `community-manager` (adaptación por red),
`horario-optimo`, `ads-manager` (lectura y creación de campañas).

### Hooks (`.claude/hooks/`, registrados en `settings.json`)
- `validar-publicacion.ps1` (PreToolUse): bloquea publicar o gastar sin aprobación. Detalle en la sección 5.
- `registrar-actividad.ps1` (PostToolUse): registra en `clientes/<c>/registro-actividad.log` cada
  llamada de publicación, anuncios o Jira.

Los comandos usan `powershell -NoProfile -ExecutionPolicy Bypass -File "$CLAUDE_PROJECT_DIR/.claude/hooks/<script>.ps1"`
(Windows PowerShell 5.1; no se asume `pwsh`).

### Scripts (`.claude/scripts/`)
`descargar-assets.ps1` (sincroniza assets desde Drive en instalaciones CLI) y `checklist-marca.ps1`
(valida un texto contra las restricciones del perfil; heurístico, no bloquea).

### Conectores MCP
| Conector | Origen | Autenticación | Estado |
|---|---|---|---|
| Google Drive / Calendar | conector de la plataforma | OAuth | en uso |
| Atlassian (Jira) | conector de la plataforma | OAuth 2.1 | en uso, **solo para el tablero de la tesis (PFMGN)** |
| Canva | conector de la plataforma | OAuth | en uso; las plantillas se generan **sin brand kit** |
| **Instagram** | propio: `mcp/instagram-publisher/` | token de Meta en variable de entorno | lectura verificada contra Meta real (2026-11-04); publicación real pendiente |
| Vercel Blob | API REST (la usa el conector) | `BLOB_READ_WRITE_TOKEN` | pendiente de verificar (el store debe ser **público**) |
| Glif | `@glifxyz/glif-mcp-server` | `GLIF_API_TOKEN` | token cargado; sin probar |
| Meta Ads | `meta-ads-mcp` (Pipeboard) | `PIPEBOARD_API_TOKEN` | no conectado; la barrera de gasto está probada con tests |

### Conector propio de Instagram (`mcp/instagram-publisher/`)
Servidor MCP por stdio, Node, **sin dependencias externas** (auditable). Herramientas:
`ver_cuenta` (lectura), `subir_archivo_publico`, `publicar_imagen`, `publicar_carrusel`,
`publicar_reel`. Ver [conectar-instagram.md](conectar-instagram.md).

## 3. Modelo de datos por cliente (`clientes/<cliente>/`)

```
perfil.md                 identidad, tono, paleta, plantillas Canva, pilares, restricciones, redes
calendario-editorial.md   tabla del mes: # · slug · fecha · red · formato · tema · hook · CTA · diseño
aprendizajes.md           resumen acumulado de qué funciona
tendencias-AAAA-MM.md     investigación del mes, con fuentes
historial/                *.plan.json (aprobaciones), *.plan.json.publicado.json, *.ads.json, AAAA-MM.md
assets/{fotos,videos,ia,exports}/
registro-actividad.log    auditoría
```

### `.plan.json` (una pieza aprobada; inmutable en contenido)
```json
{
  "cliente": "<cliente>", "fecha_creacion": "AAAA-MM-DD", "aprobado": true, "numero_post": 1,
  "red": ["instagram", "facebook"], "formato": "reel | carrusel | imagen",
  "hook_texto": "...", "caption": { "instagram": "...", "facebook": "..." },
  "diseno": { "fuente": "foto_cliente | plantilla_sin_foto | glif", "plantilla_canva": "...",
              "design_id": "...", "archivo_exportado": "ruta | [rutas de cada placa]",
              "diseno_pendiente": false },
  "video": null, "fecha_programada": "ISO-8601",
  "estado": "listo_para_publicar | listo_para_publicar_cuando_exista_conector"
}
```
`archivo_exportado` es una lista para carruseles (una ruta por placa, en orden).

### `<plan>.publicado.json`
Lo escribe el conector tras publicar: `fecha`, `tipo`, `creation_id`, `hijos` (carrusel),
`media_id`, `permalink`. Su existencia impide publicar el mismo plan dos veces.

### `<fecha>-<slug>.ads.json` (aprobación de gasto)
`cliente`, `aprobado`, `fecha_aprobacion`, `monto_confirmado` (lo escribe el usuario),
`duracion_dias`, `activacion_confirmada`, `propuesta`.

### Configuración global (`.claude/`)
- `limites.json`: `tope_mensual` por cliente. Sin entrada o con 0, el hook bloquea todo gasto.
- `instagram-cuentas.json`: `ig_user_id` por cliente (no es un secreto).
- `settings.json`: permisos (`ask` para crear/editar en Meta Ads) y registro de hooks.
- `.env.example`: nombres de las variables de entorno, siempre vacías.

## 4. Variables de entorno

Se guardan como **variables de entorno del usuario** (en Windows, en el registro), nunca en archivos del
repositorio. `.claude/.env.example` solo lista los nombres.

| Variable | Para qué |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` (o `INSTAGRAM_TOKEN_<CLIENTE>`) | token de Meta para el conector |
| `META_GRAPH_BASE` | solo si el token es de *Instagram Login* (`https://graph.instagram.com/v23.0`); vacía para tokens de Facebook Login |
| `META_GRAPH_VERSION` | versión de la Graph API (por defecto `v23.0`) |
| `BLOB_READ_WRITE_TOKEN` | subida de imágenes a Vercel Blob (store **público**) |
| `SUPABASE_URL`, `SUPABASE_KEY` | alternativa de alojamiento a Blob |
| `GLIF_API_TOKEN` | imágenes con IA |
| `PIPEBOARD_API_TOKEN` | Meta Ads (no usado todavía) |

## 5. Barreras de seguridad

| Capa | Mecanismo | Qué impide |
|---|---|---|
| 1. Comportamiento | `CLAUDE.md` y cada `SKILL.md` | actuar sin propuesta y OK |
| 2. Hook PreToolUse | `validar-publicacion.ps1` | publicar sin `.plan.json` aprobado **del cliente exacto**; gastar sin `.ads.json` con monto, sin tope en `limites.json`, por encima del monto/tope mensual, crear campañas activas o activar sin segunda confirmación |
| 3. Conector | `publisher.mjs` | publicar un plan no aprobado, de otro cliente, ya publicado, antes de su fecha programada; URLs no https; usar un caption que no sea el del plan; subir archivos fuera de `assets/` |
| 4. Permisos | `settings.json` `ask` | llamadas de creación/edición de Meta Ads sin confirmación |
| 5. Límites externos | cuenta de Meta, cuota de la API | gasto y volumen fuera del control del agente |

Principios: el caption **nunca** viene del chat sino del plan aprobado; el token no aparece en
errores ni logs (se redacta); los nombres de cliente y de plan se validan contra path traversal;
un plan aprobado es inmutable.

## 6. Decisiones de diseño

- **Conector propio de Instagram** sobre la Graph API oficial, en lugar de Postiz o Late: Postiz es
  pago, Late no tiene documentación verificada, y un conector propio permite que las herramientas
  lleven el campo `cliente` que exige el hook y que el código sea auditable.
- **Vercel Blob** para alojar imágenes: Meta descarga el medio desde una URL pública; el token de
  Blob queda acotado a un único store (la clave de Supabase da acceso a toda la base).
- **Jira solo para la tesis**: no hay proyecto de Jira por cliente; el calendario vive en
  `calendario-editorial.md`.
- **Hooks con Windows PowerShell 5.1**: un test verifica que el ejecutable de cada hook exista.
- **Plantillas de Canva sin brand kit**: la cuenta de Canva contiene brand kits de clientes reales;
  los diseños se generan describiendo la paleta en el brief.

## 7. Limitaciones conocidas

- La API de Instagram publica al instante y **no permite borrar** publicaciones: programar una
  fecha futura requiere una rutina que ejecute la publicación en ese momento.
- Facebook y TikTok no tienen conector.
- Tipos de token de Meta: los de Facebook Login (`EAA…`, usuario del sistema) necesitan la cuenta de
  Instagram y la página **asignadas** al usuario en Meta Business; los de Instagram Login (`IGAA…`)
  usan otro host.
- Meta Ads, Glif y la publicación real están programados y testeados contra servicios simulados,
  pero no se probaron contra los servicios reales.
- El checklist de marca marca palabras sueltas (por ejemplo "antes" o "después") como posibles
  violaciones: genera falsos positivos.

## 8. Pruebas

Ver [`tests/README.md`](../tests/README.md). Pester cubre hooks, scripts, estructura y esquema de
planes; los tests de Node (`node --test mcp/instagram-publisher`) cubren el conector con la Graph
API y Vercel Blob simulados. El comportamiento de los LLM se valida con los dry-runs documentados
(`clientes/*/test-fase*.md`).
