# Plan de testeo — Cierre Sprint 2 (caso real CEDITE)

**Fecha:** 2026-09-22
**Historias en Sprint 2 (proyecto Jira PFMGN):** 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
40, 41, 68, 69, 70, 74, 75.
**Ya "Listo" (no requieren testeo):** 29, 30, 35, 68, 69, 70, 75.
**En "Listo para testear" (objeto de este plan):** 28, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41.
**En curso:** 74 (Brief de marca CEDITE) — ver estado abajo, ya puede pasar a "Listo".

## Punto de partida (hecho hoy, antes de este plan)

Se subieron y organizaron en Drive los elementos que estaban en
`Documentos/CEDITE-assets/` (local). Carpeta real del cliente:

**https://drive.google.com/drive/folders/1Rz6okKQLEsIyPZU7i3Me_l20PQqSjrIf**

Estructura final:

```
CEDITE/
├── Brief de marca - CEDITE          (Google Doc, brief maestro consolidado)
├── Manual de Marca - CEDITE          (Google Doc, transcripción del manual 2013)
├── fotos/                            (vacía — pendiente que CEDITE suba material real)
├── videos/                           (vacía — pendiente que CEDITE suba material real)
├── Identidad Visual (fuente 2013)/   (los 6 archivos originales del manual: PDFs + logos)
├── Fundamentos Institucionales (Raices y Alas)/  (libro institucional, PDF + texto)
└── LEEME - Indice de la carpeta CEDITE
```

Esto deja la carpeta lista para que `/nuevo-cliente` encuentre **sin ambigüedad** un único
documento "brief" y un único documento "manual"/"marca" en la raíz — que era el riesgo real de
que el mecanismo fallara con el material real (antes había 4 PDF sueltos, ninguno con "manual" o
"marca" en el nombre).

Con esto, **PFMGN-74 (Brief de marca CEDITE)** puede pasar de "En curso" a "Listo": el brief
maestro ya existe, está en Drive, y es sensiblemente más completo que la versión de prueba usada
en el testeo técnico de PFMGN-28 (28/08).

## Qué cambia respecto a los tests técnicos ya documentados

Fases 2 a 4 ya tienen validación **técnica** del mecanismo, pero corrida contra clientes de
prueba (`cedite-drive-test`, proyecto Jira `SAM1`, brief ficticio):

- `test-fase2-PFMGN-28.md`, `test-fase3-PFMGN-34.md`, `test-fase4-PFMGN-40.md`, y
  `docs/mvp-fase-0-4.md` (PFMGN-41) — todos con el cliente sintético.

Cerrar el Sprint 2 de verdad significa repetir el mismo recorrido pero con el **perfil real de
CEDITE** generado a partir del material que se acaba de organizar, no con datos ficticios. Ese es
el criterio de aceptación real de PFMGN-28, y lo que da sentido a repetir 31-41 después.

## Secuencia de testeo

### Paso 0 — PFMGN-28: alta real del cliente

1. Ejecutar `/nuevo-cliente cedite https://drive.google.com/drive/folders/1Rz6okKQLEsIyPZU7i3Me_l20PQqSjrIf`.
2. Verificar que el skill localiza sin ambigüedad "Brief de marca - CEDITE" y "Manual de Marca -
   CEDITE", y que reporta `fotos/`/`videos/` como vacías.
3. Revisar el `perfil.md` generado: cada dato debe citar su fuente (brief vs. manual), y debe
   quedar explícito qué no está disponible todavía (redes activas, clave real de
   Jira/Calendar — hoy no hay proyecto Jira ni Calendar dedicado a CEDITE, habría que decidir si
   se crea uno nuevo o se sigue usando `SAM1` como entorno de pruebas).
4. **Aprobación humana explícita del perfil** antes de darlo por definitivo (regla del propio
   skill). Documentar resultado en `clientes/cedite/` + un `test-fase2-PFMGN-28-real.md`.

Criterio de cierre de PFMGN-28: perfil real aprobado, con fuente citada por campo. No requiere
foto/video reales todavía (eso es un paso posterior, ver "Pendientes de gestión externa").

### Paso 1 — Fase 3 con perfil real (PFMGN-31, 32, 33, 34)

1. `/plan-del-dia cedite` — validar que lee Calendar + Jira sin errores y prioriza por fecha
   (PFMGN-31). Si no hay proyecto Jira/Calendar propio de CEDITE todavía, documentar explícitamente
   que se usó el entorno de prueba `SAM1` por decisión, no por defecto silencioso.
2. Transicionar una tarea de prueba por el flujo completo de estados y confirmar registro en
   auditoría (PFMGN-32) — ya hay evidencia fuerte de esto por el uso real del propio tablero
   PFMGN (25+ transiciones), alcanza con una transición adicional sobre una tarea de CEDITE.
3. Como `/crear-post` (Fase 1) no está implementado en este roadmap, PFMGN-33 sigue dependiendo de
   esa decisión de alcance — documentar el bloqueo explícitamente en vez de simular un resultado.
4. PFMGN-34 (consolidación): 3+ dry-runs de `/plan-del-dia cedite`, con auditoría revisada.

### Paso 2 — Fase 4 con perfil real (PFMGN-36, 37, 38, 39, 40)

1. Confirmar que `estratega.md` puede correr WebSearch de tendencias para el nicho real de CEDITE
   (educación a distancia / formación docente / tecnología educativa) — no el nicho genérico
   usado antes ("centro de formación técnica" ficticio). Verificar 3-5 tendencias con fuente y
   fecha reciente (PFMGN-36).
2. `/campania-mensual cedite <mes> <objetivo>` — generar tabla completa usando los pilares de
   contenido reales del brief (no los 3 pilares inventados de la prueba). Presentar para
   aprobación humana antes de cargar nada en Jira/Calendar (PFMGN-37).
3. `/cierre-mensual cedite` — sólo tiene sentido con al menos un mes de actividad real; si no la
   hay todavía, documentar que el mecanismo se valida con datos de auditoría existentes aunque
   sean de test, y que el cierre real queda pendiente del primer mes en producción (PFMGN-38).
4. `/reporte-semanal cedite` — mismo caso: valida mecanismo, declara explícitamente qué no se
   puede medir aún por falta de conector de publicación (PFMGN-39).
5. PFMGN-40 (consolidación): esta historia pide explícitamente una **sesión real con CEDITE**
   donde el cliente institucional apruebe/edite la propuesta de campaña. Es gestión externa — no
   se puede cerrar solo con dry-runs del agente. Ver sección siguiente.

### Paso 3 — PFMGN-41: integración MVP completa con perfil real

Repetir el recorrido de `docs/mvp-fase-0-4.md` (`/nuevo-cliente → /crear-post* → /plan-del-dia →
/campania-mensual → /reporte-semanal → /cierre-mensual`) usando `clientes/cedite/` real en vez de
`cedite-drive-test`, y confirmar que la auditoría (`registro-actividad.log`) registra todo el
recorrido sin errores. (*`/crear-post` sigue fuera de alcance actual — documentar el salto en el
flujo, no simularlo.)

## Pendientes de gestión externa (no ejecutables por el agente)

Estos puntos bloquean el cierre *completo* de algunas historias y requieren acción del usuario
con CEDITE, no del agente:

- **Sesión real de aprobación con CEDITE** (PFMGN-40): mostrarle la propuesta de
  `/campania-mensual` generada con su perfil real y registrar su feedback literal.
- **Fotos y videos reales**: las carpetas `fotos/`/`videos/` de Drive están creadas pero vacías;
  sin esto, las piezas gráficas seguirán cayendo a plantilla Canva sin foto (prioridad 2 de la
  regla de material gráfico).
- **Redes activas**: el brief no confirma qué redes sociales están activas hoy — pedirlo directo
  a CEDITE antes de poder usar `/crear-post`.
- **Proyecto Jira / Calendar dedicado a CEDITE**: decidir si se crea un proyecto Jira propio (hoy
  se reutiliza `SAM1` de prueba) antes de considerar el testeo de Fase 3/4 "real" al 100%.

## Cómo documentar resultados

Seguir el mismo formato ya usado en `clientes/cedite-drive-test/test-fase*.md`: qué se validó,
cómo se hizo, resultado (✅/❌ por criterio de aceptación), y una sección "Pendiente" honesta con lo
que no se pudo cerrar por depender de terceros. Guardar los nuevos documentos en
`clientes/cedite/` (perfil real) en lugar de `clientes/cedite-drive-test/` (que queda como
evidencia histórica de la validación técnica con datos ficticios).
