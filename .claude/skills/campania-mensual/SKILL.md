---
name: campania-mensual
description: Genera el calendario editorial de un mes para un cliente, combinando su historial de rendimiento (qué funcionó antes), tendencias del nicho (WebSearch) y los pilares de contenido de su perfil. Propone una tabla completa (fecha, red, formato, tema, hook, CTA) y, solo tras aprobación humana explícita, crea las tareas correspondientes en Jira y los eventos en Calendar.
tools: Read, Write, Glob, WebSearch, mcp__gworkspace__*, mcp__atlassian__*, AskUserQuestion
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

0. **Puerta obligatoria — análisis de la cuenta antes del plan.** El plan de un mes se decide
   sobre el análisis de Instagram del mes anterior, hecho por el `community-manager`:
   - Buscar `clientes/<cliente>/analisis/<mes-anterior>.md` con `Estado: validado`. Si es el
     primer plan de la cuenta, vale el `analisis/baseline-*.md` del alta.
   - **Si falta o no está validado**: no seguir. Ofrecer (`AskUserQuestion`) ejecutar ahora
     `/analisis-cuenta <cliente> <mes-anterior>` y continuar cuando el usuario lo valide.
   - **Excepción**: solo si la cuenta de Instagram no está conectada o no tiene datos
     (cuenta nueva, sin permiso de insights) y el usuario lo confirma explícitamente. En ese
     caso el plan se marca como *hipótesis sin datos propios* en el encabezado del calendario.
   - Las **Decisiones (D1, D2…)** del análisis son el insumo principal de los pasos siguientes:
     mix de formatos, cantidad de posteos, días y horarios, pilares a reforzar o frenar,
     hashtags y experimentos. No se ignoran en silencio: si el objetivo del mes o el criterio
     del usuario obliga a apartarse de una decisión, se dice cuál y por qué.

1. **Leer memoria de la cuenta**: `clientes/<cliente>/aprendizajes.md` y
   `clientes/<cliente>/historial/*.md`. Si no existen todavía, decirlo explícitamente y avanzar
   sin datos históricos (cuenta nueva).

2. **Investigar tendencias** (WebSearch): formatos y temas en alza para el nicho del cliente,
   fechas señaladas del mes relevantes al rubro, qué está haciendo la competencia (si el perfil
   la tiene listada). Guardar el resumen en `clientes/<cliente>/tendencias-<mes>.md`, citando
   fuentes, igual que hace `estratega` en PFMGN-36.

3. **Definir la estrategia del mes** (método en `.claude/referencias/criterios-editoriales.md`):
   - **1 objetivo principal y 2–3 secundarios**, y los pilares del perfil que lo sirven.
   - **Matriz de oportunidades**: audiencia, problema/insight, diferenciador, formato, recurso
     disponible, CTA y KPI. Aclarar qué piezas apoyan pauta y cuáles son solo orgánicas.
   - **Mix por función, no por cuota**: reels para descubrimiento, carruseles para profundidad y
     guardados, historias para relación (solo si el perfil las incluye en el contrato), piezas
     comerciales para acción, testimonios/obras con consentimiento para confianza. Ajustar las
     cantidades a la producción real y a las decisiones del análisis.
   - **No duplicar**: revisar los 2 calendarios anteriores; un tema repetido solo con nuevo ángulo.
   - **Fechas**: solo efemérides y feriados verificados, con vínculo real con la marca. Si no hay
     métricas de horarios, el horario es una *hipótesis de test*, no «el mejor horario».
   - Todo dato que no esté confirmado (promos, precios, disponibilidad) va como **SUPUESTO** o
     **POR CONFIRMAR**; nunca se inventa.

4. **Proponer el calendario** como tabla:

   | # | Fecha | Red | Formato | Tema / hook | Pilar · Objetivo | CTA | Recurso | KPI | Base | Estado |
   |---|---|---|---|---|---|---|---|---|---|---|

   `Recurso` es el material real que existe (foto/video del cliente, plantilla) o **falta**.
   `Estado` arranca en *propuesta* y los POR CONFIRMAR quedan visibles. Al final, una **agenda de
   producción**: qué hay que filmar/fotografiar, quién aprueba qué, y qué recursos faltan. El
   desarrollo completo de cada pieza (ficha, guion, placas) lo hace `/crear-post` o
   `/crear-reel`, una por vez y con aprobación individual.

   (Referencia de columnas mínimas, si el espacio no alcanza: `#`, Fecha, Red, Formato, Tema,
   Hook, CTA, Base.)

   `#` es el número correlativo del posteo dentro del mes (1, 2, 3…). Cada fila también lleva
   un nombre corto (slug) para poder referenciarla luego en `/crear-post`.

   **Base** cita qué decisión del análisis respalda la fila (ej. `D2, D4`) o `experimento`
   si es una prueba declarada con su criterio de éxito. Arriba de la tabla, un resumen de cómo
   el plan cumple las decisiones: cuántos posteos de cada formato, frecuencia semanal y
   días/horarios elegidos frente a lo recomendado.

   Cada hook debe poder justificarse con un dato concreto (decisión del análisis, tendencia,
   pilar del perfil, o aprendizaje previo) — nunca un hook genérico. Respetar los pilares de contenido y las
   restricciones del `perfil.md` del cliente en cada fila.

5. **Parada obligatoria**: presentar la tabla completa al usuario (`AskUserQuestion` o
   confirmación directa en el chat). El usuario puede aprobar tal cual, reordenar, pedir
   cambios en filas puntuales, o rechazar.

6. **Si pide cambios**: ajustar solo las filas señaladas y volver a presentar la tabla completa
   actualizada — nunca asumir que el resto sigue aprobado sin volver a mostrarlo.

7. **Solo tras aprobación completa**:
   - Crear una tarea en Jira por cada fila (usando el `jira_project_key` del perfil del
     cliente), con el hook y el formato en el resumen, y la fecha como `duedate`. Si una pieza depende de
     trabajo de otra persona (filmación, diseño, revisión experta, aprobación del cliente),
     crear la **subtarea relacionada** correspondiente en vez de dejarlo implícito.
   - Crear un evento en el Calendar del cliente (`google_calendar_id` del perfil) por cada fila,
     en la fecha y horario propuestos.
   - Guardar la tabla aprobada en `clientes/<cliente>/calendario-editorial.md`, reemplazando el
     contenido anterior de ese mes si existía.

8. Confirmar al usuario cuántas tareas y eventos se crearon, con enlaces.

9. **Siguiente paso (cuando la campaña está aprobada por el cliente)**: ofrecer con
   `AskUserQuestion` cómo seguir con las piezas:
   - **Un posteo puntual**: indicar el número (`#`) o el nombre/slug → `/crear-post <cliente> <#|slug>`.
   - **Historias**: `/crear-historias <cliente> <#|slug>` (se publican por API; las que llevan stickers
     o links quedan como plan manual).
   - **Todos juntos**: `/crear-post <cliente> todos`, que diseña el lote completo y presenta
     las piezas una por una para aprobación individual.
   - **Más tarde**: no hacer nada ahora.
   Solo ofrecer este paso si la tabla fue aprobada; no iniciarlo sin que el usuario elija.

## Reglas

- **Sin análisis validado del mes anterior no se arma el plan** (paso 0), salvo la excepción
  confirmada de cuenta sin datos.
- Nunca crear tareas en Jira ni eventos en Calendar antes del paso 7 (aprobación completa de la
  tabla) — ni una fila suelta, ni "para adelantar trabajo".
- Si `jira_project_key` o `google_calendar_id` no están completados en el perfil del cliente,
  avisar y no intentar crear nada ahí — se puede seguir generando y guardando la tabla igual.
- El calendario editorial de un mes reemplaza al anterior del mismo mes solo si el usuario lo
  confirma explícitamente (para evitar pisar un mes ya aprobado por error).
