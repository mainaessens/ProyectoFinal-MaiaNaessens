# MVP — Fases 0 a 4 (integración completa)

**Fecha:** 2026-08-23
**Historia:** PFMGN-41

## Objetivo de este documento

Verificar que el flujo completo `/nuevo-cliente → /crear-post → /plan-del-dia →
/campania-mensual` funciona de punta a punta, con auditoría completa, como base para la
demo de defensa de tesis.

## Flujo verificado end-to-end (cliente de prueba: cedite-drive-test)

```
/nuevo-cliente cedite-drive-test <url-drive>
   → lee brief + manual de marca de Drive automáticamente
   → genera perfil.md citando la fuente de cada dato (Fase 2)
        ↓
/crear-post cedite-drive-test <tema>   (x5, dry-run)
   → hook + caption por red (IG/FB) + checklist de marca
   → 1 caso detectó violación → corrección → nueva versión aprobada
   → genera .plan.json (Fase 1, modo PLAN sin publicar)
        ↓
/plan-del-dia cedite-drive-test
   → lee Calendar + Jira, vista unificada por fecha
   → transición de estado de una tarea desde el skill (Fase 3)
        ↓
/campania-mensual cedite-drive-test 2026-09 "aumentar alcance"
   → lee tendencias.md + aprendizajes.md
   → WebSearch de tendencias del nicho, con fuentes
   → propuesta de 8 publicaciones → aprobación → 8 tareas Jira + 8 eventos Calendar (Fase 4)
        ↓
/reporte-semanal cedite-drive-test  →  /cierre-mensual cedite-drive-test
   → historial/2026-08.md  →  aprendizajes.md actualizado
   → alimenta el próximo /campania-mensual (ciclo de aprendizaje cerrado)
```

## Verificación de auditoría

Todas las acciones de las Fases 0-4 quedaron registradas en
`clientes/cedite-drive-test/registro-actividad.log`: alta de cliente, 5 dry-runs de
`/crear-post` (incluyendo el caso de corrección), 2 búsquedas de tendencias, la carga de la
campaña de septiembre, el reporte semanal y el cierre mensual. Nada de esto requirió tocar el
log a mano — cada skill lo actualiza como parte de su propio procedimiento.

## Estado por fase

| Fase | Estado | Nota |
|---|---|---|
| 0 — Base local | ✅ Completa | |
| 1 — Publicación multi-red | ✅ Completa salvo PFMGN-16 | Conector Late/Postiz requiere coordinación externa (cuenta real) |
| 2 — Google Drive | ✅ Completa salvo la mitad de PFMGN-28 | Mecanismo validado; falta brief real de CEDITE |
| 3 — Calendar + Jira | ✅ Completa salvo la integración con /crear-post en PFMGN-33 | Se construyó como pieza reutilizable (`horario-optimo.md`) a la espera de /crear-post con conector real |
| 4 — Tendencias y campaña mensual | ✅ Completa salvo la mitad de PFMGN-40 | Mecanismo validado; falta sesión real con CEDITE |

## Qué falta para una demo 100% con datos reales

1. Brief y manual de marca reales de CEDITE en Drive (historia PFMGN-69, en curso).
2. Coordinar la cuenta de Late/Postiz para publicar de verdad (Fase 1, PFMGN-16).
3. Reemplazar el proyecto de prueba `SAM1` por un proyecto real de Jira para CEDITE.
4. Una sesión de validación con referentes del CEDITE, como pide el Plan de Trabajo (tutor,
   cotutor, cliente institucional).

## Conclusión

El MVP de las Fases 0-4 funciona de punta a punta con datos de prueba, con control humano en
cada punto de aprobación (nunca se publica, crea en bloque, o carga en Jira/Calendar sin OK
explícito) y con trazabilidad completa en el log de auditoría. Está listo para la demo técnica;
la validación con datos y usuarios reales del CEDITE queda como paso siguiente, fuera del
alcance de lo que se puede resolver sin esa coordinación externa.
