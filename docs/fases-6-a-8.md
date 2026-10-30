# Fases 6, 7 y 8 — estado

| Fase | Pieza | Estado |
|---|---|---|
| 6 — Imágenes IA (Glif) | Regla de prioridad en `CLAUDE.md`, "Estilo IA" en el perfil, carpeta `assets/ia/`, máximo 2 variantes y reutilización en `agents/disenador.md` | Código y reglas listos. **Sin probar contra Glif real**: falta `GLIF_API_TOKEN` |
| 7 — Meta Ads, solo lectura | `agents/ads-manager.md` (modo lectura), alimenta `/reporte-semanal` y `/cierre-mensual` | Agente listo. **Sin probar contra Meta real**: falta `PIPEBOARD_API_TOKEN` y cuenta publicitaria |
| 8 — Meta Ads, creación | `hooks/validar-publicacion.ps1` v2, `limites.json`, skill `/lanzar-campania-ads`, aprobación `*.ads.json`, permisos `ask` en `settings.json` | Barrera técnica **probada con 12 tests** (`tests/ValidarGasto.Tests.ps1`). Skill sin ejecutar contra Meta real |
| Extra — `/crear-reel` | Skill de reel (guion, video real del cliente, portada Canva, plan) | Escrito; sin dry-run todavía |

## Barreras de gasto (Fase 8)

1. Límite de gasto en la propia cuenta de Meta (externa; hay que configurarla).
2. `limites.json`: sin `tope_mensual > 0` para el cliente, el hook bloquea todo gasto.
3. `*.ads.json` con `aprobado: true` y `monto_confirmado` (el usuario lo escribe): un plan de
   publicación aprobado **no** habilita gasto.
4. La llamada no puede superar el monto confirmado (`monto`, `lifetime_budget`, o
   `daily_budget × duracion_dias`), ni las aprobaciones del mes el tope mensual.
5. Se crea siempre con `status: PAUSED`; activar exige `activacion_confirmada: true`.
6. Permisos `ask` en `settings.json` para toda herramienta de creación/edición de Meta Ads.

## Pendiente externo

- Tokens: `GLIF_API_TOKEN`, `PIPEBOARD_API_TOKEN`, `LATE_API_KEY`.
- Cuenta publicitaria del cliente y límite de gasto en Meta.
- Conector de publicación (Late/Postiz) y cómo pasa `cliente` al hook (PFMGN-16).
- Antes del primer cliente real: simulacro de campaña pausada de monto mínimo.
