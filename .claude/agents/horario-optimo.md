---
name: horario-optimo
description: Lógica reutilizable para sugerir un horario de publicación con menos conflictos, leyendo Calendar y el histórico de rendimiento del cliente. Pensada para ser invocada por el futuro skill /crear-post (Fase 1, aún no implementada en este roadmap) y, mientras tanto, por /plan-del-dia cuando el usuario pida agendar algo puntual.
tools: mcp__gworkspace__*, Read
---

# Lógica: horario óptimo de publicación

## Cuándo se usa

Cuando hay que proponerle al usuario un horario para publicar (o grabar, o cualquier tarea con
horario) y se quiere evitar choques con lo que ya está agendado, apoyándose en lo que
históricamente funcionó mejor para esa cuenta.

**Nota de dependencia (PFMGN-33):** esta lógica está pensada para integrarse dentro del skill
`/crear-post`, que pertenece a la Fase 1 (Publicación multi-red) del roadmap y todavía no se
implementó en este proyecto. Hasta que exista `/crear-post`, esta pieza se usa de forma
independiente: el usuario puede pedir "sugerime un horario para publicar el [tema] el [fecha]"
y se aplica el mismo procedimiento.

## Procedimiento

1. Leer `clientes/<cliente>/historial/*.md` (si existen) buscando menciones de horarios que
   hayan rendido bien en meses anteriores (ej. "el reel de las 19h tuvo más alcance").
   Si no hay historial todavía, saltar este paso y decirlo explícitamente.
2. Leer los eventos ya agendados en el Calendar del cliente (`gworkspace`) para el día objetivo.
3. Identificar franjas horarias del día objetivo sin conflicto con eventos existentes,
   priorizando (en este orden):
   - Un horario que el historial marque como buen rendimiento para ese tipo de contenido.
   - Si no hay dato histórico, un horario típico de buen alcance para redes sociales en general
     (mediodía o entre las 19 y 21hs), ajustado para no chocar con eventos ya agendados.
4. Proponer el horario al usuario, mostrando en qué se basó la sugerencia (histórico, o
   heurística general si no había datos).
5. El usuario puede aceptar o cambiar el horario libremente.
6. Solo si el usuario aprueba, se crea el evento en Calendar (`create_event`) — nunca antes de
   la aprobación.

## Reglas

- Nunca crear el evento en Calendar sin aprobación explícita del usuario (misma regla de oro
  del resto del sistema).
- Si no se pudo leer el historial o el Calendar por un error de conector, decirlo y proponer un
  horario igual, dejando claro que es una sugerencia sin verificar contra la agenda real.
