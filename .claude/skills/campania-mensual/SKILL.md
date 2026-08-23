---
name: campania-mensual
description: Genera el calendario editorial de un mes para un cliente, combinando su historial de rendimiento (qué funcionó antes), tendencias del nicho (WebSearch) y los pilares de contenido de su perfil. Propone una tabla completa (fecha, red, formato, tema, hook, CTA) y, solo tras aprobación humana explícita, crea las tareas correspondientes en Jira y los eventos en Calendar.
tools: Read, Write, WebSearch, mcp__gworkspace__*, mcp__atlassian__*, AskUserQuestion
---

# /campania-mensual

Propone el calendario editorial completo de un mes para un cliente.

## Uso

```
/campania-mensual <cliente> <mes> <objetivo>
```

- `<cliente>`: nombre de la carpeta en `clientes/<cliente>/`.
- `<mes>`: mes objetivo (ej: `2026-09`).
- `<objetivo>`: objetivo de la campaña (ej: "aumentar alcance", "difundir inscripciones",
  "posicionar un área nueva").

## Procedimiento (ejecutado por el subagente `estratega`)

1. **Leer memoria de la cuenta**: `clientes/<cliente>/aprendizajes.md` y
   `clientes/<cliente>/historial/*.md`. Si no existen todavía, decirlo explícitamente y avanzar
   sin datos históricos (cuenta nueva).

2. **Investigar tendencias** (WebSearch): formatos y temas en alza para el nicho del cliente,
   fechas señaladas del mes relevantes al rubro, qué está haciendo la competencia (si el perfil
   la tiene listada). Guardar el resumen en `clientes/<cliente>/tendencias-<mes>.md`, citando
   fuentes, igual que hace `estratega` en PFMGN-36.

3. **Proponer el calendario** como tabla:

   | Fecha | Red | Formato | Tema | Hook | CTA |
   |---|---|---|---|---|---|

   Cada hook debe poder justificarse con un dato concreto (tendencia, pilar del perfil, o
   aprendizaje previo) — nunca un hook genérico. Respetar los pilares de contenido y las
   restricciones del `perfil.md` del cliente en cada fila.

4. **Parada obligatoria**: presentar la tabla completa al usuario (`AskUserQuestion` o
   confirmación directa en el chat). El usuario puede aprobar tal cual, reordenar, pedir
   cambios en filas puntuales, o rechazar.

5. **Si pide cambios**: ajustar solo las filas señaladas y volver a presentar la tabla completa
   actualizada — nunca asumir que el resto sigue aprobado sin volver a mostrarlo.

6. **Solo tras aprobación completa**:
   - Crear una tarea en Jira por cada fila (usando el `jira_project_key` del perfil del
     cliente), con el hook y el formato en el resumen, y la fecha como `duedate`.
   - Crear un evento en el Calendar del cliente (`google_calendar_id` del perfil) por cada fila,
     en la fecha y horario propuestos.
   - Guardar la tabla aprobada en `clientes/<cliente>/calendario-editorial.md`, reemplazando el
     contenido anterior de ese mes si existía.

7. Confirmar al usuario cuántas tareas y eventos se crearon, con enlaces.

## Reglas

- Nunca crear tareas en Jira ni eventos en Calendar antes del paso 6 (aprobación completa de la
  tabla) — ni una fila suelta, ni "para adelantar trabajo".
- Si `jira_project_key` o `google_calendar_id` no están completados en el perfil del cliente,
  avisar y no intentar crear nada ahí — se puede seguir generando y guardando la tabla igual.
- El calendario editorial de un mes reemplaza al anterior del mismo mes solo si el usuario lo
  confirma explícitamente (para evitar pisar un mes ya aprobado por error).
