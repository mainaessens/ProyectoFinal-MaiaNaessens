---
name: plan-del-dia
description: Lee Google Calendar y Jira de un cliente (o de todos los clientes activos) y arma una lista priorizada de qué hay que hacer hoy y en la próxima semana. Solo lectura — nunca modifica Calendar ni Jira salvo que el usuario pida explícitamente marcar una tarea como "en curso" o "completada", lo cual se hace vía transición de Jira y queda registrado en el log de actividad del cliente.
tools: Read, Write, mcp__gworkspace__*, mcp__atlassian__*
---

# /plan-del-dia

Arma la lista priorizada de trabajo del día (y un vistazo a la semana) para un cliente.

## Uso

```
/plan-del-dia <cliente> [fecha-opcional]
```

- `<cliente>`: nombre de la carpeta en `clientes/<cliente>/`.
- `[fecha-opcional]`: fecha en formato `AAAA-MM-DD`. Si no se da, se usa la fecha actual.

## Procedimiento

1. **Leer `clientes/<cliente>/perfil.md`** y obtener de la sección "Organización (Fase 3)":
   - la clave del proyecto de Jira (`jira_project_key`)
   - el ID del calendario de Google (`google_calendar_id`)

   Si alguno de los dos no está completado en el perfil, avisar y continuar solo con lo que sí
   esté disponible (no bloquear el skill por falta de un dato).

2. **Leer eventos de Calendar** (`gworkspace`) del calendario del cliente, filtrando entre la
   fecha objetivo y 7 días después.

3. **Leer issues de Jira** (`atlassian`) del proyecto del cliente con una JQL equivalente a:
   ```
   project = <jira_project_key> AND (duedate <= <fecha+7d> OR duedate is EMPTY)
   AND statusCategory != Done
   ORDER BY duedate ASC, priority DESC
   ```

4. **Unificar en una sola vista**, por fecha, mezclando eventos de Calendar (con su horario) y
   tareas de Jira (con su fecha límite, o "sin fecha" si no tienen `duedate`). Dentro de un mismo
   día: primero los eventos de Calendar en orden de horario, después las tareas de Jira en orden
   de prioridad.

5. **Separar visualmente "Hoy" del resto de la semana.**

6. **Presentar la lista** al usuario, agrupada por cliente si se corrieron varios clientes a la
   vez. No se modifica nada todavía en este paso.

7. **Si el usuario pide marcar una tarea como "en curso" o "completada"**: usar
   `getTransitionsForJiraIssue` para encontrar la transición correspondiente y
   `transitionJiraIssue` para aplicarla. Después, agregar una línea a
   `clientes/<cliente>/registro-actividad.log` con fecha, issue, y el cambio de estado.

## Reglas

- Este skill **nunca** crea, edita ni borra eventos de Calendar ni issues de Jira por su cuenta.
  La única escritura permitida es la transición de estado que el usuario pida explícitamente en
  el paso 7, y siempre queda registrada en el log de actividad.
- Si Calendar o Jira devuelven error (token vencido, proyecto no encontrado, etc.), mostrar el
  error claramente y seguir mostrando lo que sí se pudo leer de la otra fuente — no fallar todo
  el skill por un solo conector caído.
- Si se corre sin especificar cliente, se puede ofrecer correr el plan para todos los clientes
  con `clientes/<nombre>/perfil.md` existente, uno por uno.
