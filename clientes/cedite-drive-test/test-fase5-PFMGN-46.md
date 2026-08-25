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

## Pendiente — bloqueado por dependencias externas

- **PFMGN-42** (conector Canva): requiere que se conecte una cuenta de Canva vía OAuth — no
  apareció disponible en esta sesión al momento de este test.
- **PFMGN-43** (plantillas maestras reales): diseño manual en la interfaz de Canva, no
  automatizable.
- La validación real de "3+ dry-runs con diseños Canva generados de verdad" y la revisión de
  CEDITE sobre paleta/tono del diseño quedan pendientes hasta que existan ambos.
