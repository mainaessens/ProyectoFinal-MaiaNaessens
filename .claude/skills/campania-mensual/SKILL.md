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
     disponible, CTA y KPI.
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
   producción**: qué hay que filmar/fotografiar, quién aprueba qué, y qué recursos faltan.
   La tabla es el índice: el contenido de cada pieza se desarrolla en el paso 5.

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

5. **Desarrollar el contenido de cada pieza** (obligatorio, no se omite ni se difiere a
   `/crear-post`). Para **cada fila** de la tabla, escribir su ficha con el método ya definido en
   las referencias, sin inventar otro: `.claude/referencias/guia-formatos.md` (estructura de la
   ficha por formato), `.claude/referencias/criterios-editoriales.md` (hook, tono, prioridades) y
   el `perfil.md` del cliente. Sin esto, la tabla no está completa:
   - **Reel**: ficha de entrega completa: título · objetivo · duración estimada · público ·
     concepto · 2–3 opciones de hook con el elegido y su porqué · guion escena por escena
     (tiempo, quién habla, texto exacto o pauta, plano/acción/B-roll/texto en pantalla) · audio ·
     recursos · CTA · copy sugerido · portada · indicaciones de edición · datos a confirmar.
   - **Carrusel**: placa por placa (portada, placa 2, desarrollo, cierre, CTA), cada una con
     TÍTULO · TEXTO FINAL · FUNCIÓN · IDEA VISUAL · elemento real requerido · transición; más
     caption sugerido y CTA único.
   - **Historias**: por cada historia de la secuencia: función, texto exacto en pantalla, recurso,
     sticker/encuesta/link si lleva (y por tanto si queda `manual`), objetivo y CTA.
   - **Post simple / otros formatos**: idea, texto en la pieza, caption, recurso y CTA.
   - En todas: recurso real que existe en `assets/` (nombrar el archivo) o **falta**; lo no
     confirmado va como **SUPUESTO / POR CONFIRMAR**; cita la decisión (D#) que la respalda.
     Respetar tono, pilares y restricciones del `perfil.md`.
   - Cada ficha se encabeza con `### #<n> · <slug> · <fecha> · <formato>`.
   - Es un desarrollo de planificación: no genera diseños en Canva, ni videos, ni planes
     `.plan.json` (eso es `/crear-post`, `/crear-reel` y `/crear-historias`, que parten de esta
     ficha sin rehacerla salvo que el usuario pida cambios).

6. **Autoevaluar cada ficha** con `.claude/referencias/autoevaluacion.md` (0–2 en 10 criterios):
   las que no lleguen a 16/20 o fallen en exactitud se reescriben antes de mostrarlas. Poner el
   puntaje en el encabezado de cada ficha.

7. **Parada obligatoria**: presentar la tabla completa **y el desarrollo de cada pieza** al usuario (`AskUserQuestion` o
   confirmación directa en el chat). El usuario puede aprobar tal cual, reordenar, pedir
   cambios en filas puntuales, o rechazar.

8. **Si pide cambios**: ajustar solo las filas señaladas y volver a presentar la tabla completa
   actualizada — nunca asumir que el resto sigue aprobado sin volver a mostrarlo.

9. **Solo tras aprobación completa**:
   - Crear una tarea en Jira por cada fila (usando el `jira_project_key` del perfil del
     cliente), con el hook y el formato en el resumen, y la fecha como `duedate`. Si una pieza depende de
     trabajo de otra persona (filmación, diseño, revisión experta, aprobación del cliente),
     crear la **subtarea relacionada** correspondiente en vez de dejarlo implícito.
   - Crear un evento en el Calendar del cliente (`google_calendar_id` del perfil) por cada fila,
     en la fecha y horario propuestos.
   - Guardar en `clientes/<cliente>/calendario-editorial.md`, reemplazando el contenido anterior
     de ese mes si existía: primero la tabla aprobada y después la sección
     `## Desarrollo de piezas` con las fichas del paso 5.
   - En cada tarea de Jira, incluir en la descripción un resumen de la ficha de esa pieza.

10. Confirmar al usuario cuántas tareas y eventos se crearon, con enlaces. Ejecutar
    `/sincronizar-drive <cliente>` para subir el calendario y el desarrollo de las piezas a Drive.

11. **Siguiente paso (cuando la campaña está aprobada por el cliente)**: ofrecer con
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
- **Una tabla sin el desarrollo de cada reel, carrusel e historia está incompleta**: no se
  presenta como lista para aprobar (paso 5).
- Nunca crear tareas en Jira ni eventos en Calendar antes del paso 9 (aprobación completa de la
  tabla) — ni una fila suelta, ni "para adelantar trabajo".
- Si `jira_project_key` o `google_calendar_id` no están completados en el perfil del cliente,
  avisar y no intentar crear nada ahí — se puede seguir generando y guardando la tabla igual.
- El calendario editorial de un mes reemplaza al anterior del mismo mes solo si el usuario lo
  confirma explícitamente (para evitar pisar un mes ya aprobado por error).
