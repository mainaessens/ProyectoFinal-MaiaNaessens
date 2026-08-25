# Test técnico — Fase 5 (PFMGN-46)

**Fecha:** 2026-08-24

## Qué se validó

Que `/crear-post` documente correctamente el paso de diseño (`disenador`) en modo plan mientras
el conector de Canva no está registrado, sin bloquear el resto del pipeline ni inventar que se
generó una pieza gráfica real.

## Dry-run ejecutado

1 dry-run: "3 señales de que elegiste bien tu especialización técnica" (pilar: tips rápidos).
El plan generado incluye la sección `"diseno"` con `"diseno_pendiente": true` y el nombre de la
plantilla que se usaría cuando exista (`cedite-carrusel-tips`, aún no creada — PFMGN-43).
`checklist-marca.ps1` validó el caption sin violaciones antes de aprobar.

## Resultado

✅ El pipeline no se rompe ni inventa un diseño inexistente cuando Canva no está conectado —
lo declara explícitamente. ✅ Suite de tests automatizados (103/103) sigue pasando con el nuevo
campo `diseno` en el esquema de `.plan.json`.

## Actualización 2026-08-24 — Canva conectado

El usuario conectó Canva (cuenta real de la agencia, con brand kits de clientes reales). Se
verificó la conexión (`list-brand-kits`, sin errores) y se generaron **3 plantillas maestras
reales** para `cedite-drive-test` sin usar ningún brand kit real (paleta descrita en el prompt):

| Formato | Design ID | Link |
|---|---|---|
| Post | `DAHTQqkVIaI` | https://www.canva.com/d/ZNndSNw08aK8L_D |
| Carrusel | `DAHTQtHOb8U` | https://www.canva.com/d/SiycG5YCRJbuK-k |
| Historia/reel cover | `DAHTQrQo3-U` | https://www.canva.com/d/SGFek9sXSII95pD |

Se generó además una pieza real con el hook real del dry-run anterior ("3 señales de que
elegiste bien tu especialización técnica", `DAHTQn41mvY`), se exportó a PNG exitosamente
(`get-export-formats` + `export-design`), y se actualizó el `.plan.json` correspondiente con
`diseno_pendiente: false` y el `design_id` real. La suite de tests automatizados (103/103)
sigue pasando con estos datos reales.

## Pendiente

- **PFMGN-46 (parcial):** falta la revisión real de CEDITE (cliente institucional) sobre si la
  paleta/tono de los diseños generados es la correcta — eso requiere la sesión real con el
  cliente, que sigue sin poder resolverse desde acá.
