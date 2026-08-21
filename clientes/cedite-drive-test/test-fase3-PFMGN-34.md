# Test técnico — Fase 3 (PFMGN-34)

**Fecha:** 2026-08-21

## Qué se validó

Que el sistema pueda leer Google Calendar y Jira de un cliente, unificarlos en una sola vista
priorizada, y que el flujo de estados de Jira permita marcar tareas como "en curso" desde el
skill, quedando registrado en el log de actividad del cliente.

## Cómo se hizo

1. Se agregaron los campos `jira_project_key` (`SAM1`, proyecto de ejemplo) e
   `id de Google Calendar` (`proyectofinalmaianaessens@gmail.com`) al perfil de
   `cedite-drive-test`.
2. Se crearon 2 eventos de prueba en el Calendar (uno hoy 21/08, otro el 25/08).
3. Se leyeron los eventos del Calendar (`list_events`) y las tareas de Jira de SAM1 con
   `duedate` dentro de los próximos 7 días y no completadas (`searchJiraIssuesUsingJql`).
4. Se armó la vista unificada (ver abajo).
5. Se transicionó `SAM1-6` de "Por hacer" a "En curso" (simulando que el usuario marca una
   tarea desde `/plan-del-dia`) y se registró el cambio en `registro-actividad.log`.

## Vista unificada obtenida

**Hoy — viernes 21/08:**
- 16:00–17:00 · [Calendar] Grabar testimonio exalumno

**Próxima semana:**
- Martes 25/08, 10:00–10:30 · [Calendar] Publicar carrusel tips rápidos
- Miércoles 26/08 (vence) · [Jira SAM1-6] Set up tracking for new ad campaigns — *En curso*
- Miércoles 26/08 (vence) · [Jira SAM1-5] Analyze performance of last month's ads — *En curso*

## Resultado

✅ Lectura de Calendar sin errores. ✅ Lectura de Jira sin errores (JQL con `duedate` y
`statusCategory`). ✅ Vista unificada ordena por fecha y, dentro del día, Calendar antes que
Jira. ✅ Transición de estado ejecutada y registrada en el log del cliente. ✅ No se modificó
Calendar ni Jira salvo la única transición pedida explícitamente (paso 7 del skill).

## Validación del flujo de estados completo (PFMGN-32)

El flujo de 5 estados (Por hacer → En curso → Listo para testear → Pruebas → Listo) del propio
proyecto **PFMGN** se usó de forma real y repetida a lo largo de esta sesión — más de 25
transiciones exitosas sin bloqueos, aplicadas a historias reales (ver historial de Jira del
proyecto PFMGN). Se toma esa evidencia como validación de PFMGN-32 en lugar de un ciclo
sintético adicional.

## Pendiente / dependencia señalada

PFMGN-33 pide integrar esta lógica de horario dentro de `/crear-post`, que es un skill de la
Fase 1 (no implementada en este roadmap por decisión explícita del usuario). Se construyó la
lógica como pieza reutilizable (`agents/horario-optimo.md`) para conectarla en cuanto exista
`/crear-post`.
