# Test técnico — Fase 1 (PFMGN-17 a PFMGN-22)

**Fecha:** 2026-08-21

## Qué se validó

Que el pipeline completo de `/crear-post` (hook + caption adaptado por red + checklist de marca
+ PLAN de publicación) funcione end-to-end sin publicar de verdad, y que los hooks técnicos
(`validar-publicacion.ps1`, `registrar-actividad.ps1`) funcionen como red de seguridad.

## Piezas construidas

- `agents/community-manager.md` — adapta caption a IG/FB, arma el PLAN.
- `agents/horario-optimo.md` (Fase 3) — reutilizado para sugerir horario.
- `hooks/validar-publicacion.ps1` — PreToolUse, bloquea publicar sin `.plan.json` aprobado.
- `hooks/registrar-actividad.ps1` — PostToolUse, registra auditoría por cliente.
- `skills/crear-post/SKILL.md` — pipeline completo, genera PLAN (no publica).

## Pruebas de los hooks

| Caso | Resultado esperado | Resultado obtenido |
|---|---|---|
| `validar-publicacion.ps1` sin ningún `.plan.json` aprobado | Bloquea, exit code 2 | ✅ Bloqueó con mensaje claro |
| `validar-publicacion.ps1` con un `.plan.json` aprobado presente | Permite, exit code 0 | ✅ Permitió |
| `registrar-actividad.ps1` con una tool relevante | Agrega línea al log del cliente | ✅ Línea agregada correctamente |

## 5 dry-runs de `/crear-post` (cliente cedite-drive-test)

1. **Testimonio — Sofía**: hook + caption IG/FB, checklist sin violaciones, plan generado.
2. **Detrás de cámara — clase práctica**: ídem, sin violaciones.
3. **Tip rápido — errores comunes**: primera versión mencionaba "empleo garantizado" →
   `checklist-marca.ps1` la marcó con alerta → se generó una segunda versión sin esa mención →
   pasó limpia → plan generado con la versión corregida. **Este caso demuestra el ciclo
   "usuario pide cambios → nueva versión" funcionando de punta a punta.**
4. **Testimonio — Martín**: sin violaciones.
5. **Detrás de cámara — laboratorio**: sin violaciones.

Los 5 planes quedaron en `clientes/cedite-drive-test/historial/*.plan.json`, todos con
`"aprobado": true` y `"estado": "listo_para_publicar_cuando_exista_conector"`.

## Resultado

✅ 5/5 dry-runs completados sin errores. ✅ Auditoría completa en `registro-actividad.log`.
✅ Hooks verificados en ambos sentidos (bloqueo y permiso). ✅ El sistema queda "listo para
publicar de verdad" en cuanto se registre el conector Late/Postiz — lo único que falta de la
Fase 1 y que sí requiere coordinación externa (cuenta y API key).

## Pendiente (fuera del alcance de "sin información del cliente")

- **PFMGN-16** (registrar MCP de Late/Postiz): requiere una cuenta real de Late y credenciales
  de Instagram/Facebook — coordinación externa, no se puede resolver desde acá.
