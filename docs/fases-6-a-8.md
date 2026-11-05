# Fases 1, 6, 7 y 8 — estado (2026-11-04)

| Fase | Pieza | Estado |
|---|---|---|
| 1 — Publicación | Conector propio de Instagram (`mcp/instagram-publisher/`): imagen, **carrusel**, reel, subida a Vercel Blob | Lectura verificada contra Meta real; publicación real **pendiente** (hace falta un store de Blob público). 24 tests con servicios simulados |
| 6 — Imágenes IA (Glif) | Regla de prioridad en `CLAUDE.md`, "Estilo IA" en el perfil, `assets/ia/`, máximo 2 variantes y reutilización en `agents/disenador.md` | Reglas y token listos; **sin probar** contra Glif real |
| 7 — Meta Ads, lectura | `agents/ads-manager.md` (modo lectura), alimenta `/reporte-semanal` y `/cierre-mensual` | Agente listo; **sin conectar** (decisión: Meta Ads queda para el final) |
| 8 — Meta Ads, creación | `validar-publicacion.ps1` v2, `limites.json`, `/lanzar-campania-ads`, `*.ads.json`, permisos `ask` | Barrera técnica probada con 12 tests (`tests/ValidarGasto.Tests.ps1`); skill sin ejecutar contra Meta real |
| Extra — `/crear-reel` | Guion, video real del cliente, portada Canva, plan | Escrito; dry-run con datos de prueba |

## Barreras de gasto (Fase 8)

1. Límite de gasto en la propia cuenta de Meta (externa).
2. `limites.json`: sin `tope_mensual > 0` para el cliente, el hook bloquea todo gasto.
3. `*.ads.json` con `aprobado: true` y `monto_confirmado` (el usuario lo escribe): un plan de
   publicación aprobado **no** habilita gasto.
4. La llamada no puede superar el monto confirmado (`monto`, `lifetime_budget`, o
   `daily_budget × duracion_dias`), ni las aprobaciones del mes el tope mensual.
5. Se crea siempre con `status: PAUSED`; activar exige `activacion_confirmada: true`.
6. Permisos `ask` en `settings.json` para toda herramienta de creación/edición de Meta Ads.

## Pendiente externo

- Store de Vercel Blob **público** y su token, para la primera publicación real.
- Token de Glif probado; `PIPEBOARD_API_TOKEN` y cuenta publicitaria (cuando se decida usar Meta Ads).
- Facebook y TikTok: sin conector.
- Rutina que ejecute las publicaciones a su hora (la API de Instagram publica al instante).
- Antes del primer cliente con gasto real: simulacro de campaña pausada de monto mínimo.

Ver [arquitectura.md](arquitectura.md) y [flujo-de-trabajo.md](flujo-de-trabajo.md).
