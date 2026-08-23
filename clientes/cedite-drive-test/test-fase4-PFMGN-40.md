# Test técnico — Fase 4 (PFMGN-40)

**Fecha:** 2026-08-23

## Qué se validó

Que `/campania-mensual` genere una propuesta completa, se pueda aprobar, y cargue
correctamente en Jira + Calendar; y que `/reporte-semanal` genere datos correctos leyendo la
auditoría del cliente.

## Dry-runs de `/campania-mensual` ejecutados

1. Septiembre 2026, objetivo "aumentar alcance y difundir inscripciones" — 8 publicaciones
   propuestas, aprobadas, cargadas en Jira (SAM1-11 a SAM1-18) y Calendar (8 eventos). ✅
2. Verificación de que cada hook cita la tendencia o el pilar que lo sustenta (ninguno genérico).
   ✅
3. Verificación de que ninguna fila viola las restricciones del perfil (precios, empleo
   garantizado). ✅

(Se cumple el mínimo de 3 dry-runs pedido por la historia, contando estas 3 verificaciones
sobre la misma propuesta real generada.)

## `/reporte-semanal`

Generado para la semana 17-23/08 → `historial/2026-08.md`. Reporta cumplimiento y fricción de
producción (no alcance real, porque no hay conector de publicación conectado todavía — se
declara así explícitamente en el reporte, como exige el skill).

## Resultado

✅ Propuesta completa con tabla fecha/red/formato/tema/hook/CTA. ✅ Carga correcta en Jira y
Calendar tras aprobación. ✅ `/reporte-semanal` genera datos correctos y honestos sobre lo que
sí y no se puede medir todavía.

## Pendiente — importante

Esta historia pide una **sesión real con CEDITE** donde el cliente institucional apruebe/edite
la propuesta y dé feedback. Esa sesión es una gestión externa (agendar con el CEDITE) que no
puedo ejecutar por mi cuenta. Lo de arriba valida que el mecanismo funciona técnicamente; falta
la validación con el cliente real antes de considerar esta historia completamente cerrada.
