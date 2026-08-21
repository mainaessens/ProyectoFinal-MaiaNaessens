# Test manual — Fase 0 (PFMGN-14)

**Fecha:** 2026-08-21
**Cliente de prueba:** cedite-test (datos ficticios, ver nota en `perfil.md`)

## Paso 1 — Ejecutar `/nuevo-cliente`

Estructura creada en `clientes/cedite-test/`: `perfil.md`, `calendario-editorial.md`,
`aprendizajes.md`, `historial/`, `assets/fotos/`, `assets/videos/`, `registro-actividad.log`.
✅ OK.

## Paso 2 — Pedir 3 ideas de post basadas en el perfil

**Prompt de prueba:** "Dame 3 ideas de post para CEDITE (test) para esta semana."

**Respuesta del agente:**

1. **"3 cosas que aprendés en tu primera semana de clases prácticas"** — carrusel mostrando
   herramientas/ejercicios reales del taller, cerrando con "aprendé haciendo, desde el día 1".
   *(pilar: detrás de cámara de las clases prácticas)*

2. **"De estudiante a technician: la historia de [Nombre]"** — reel corto con testimonio de un
   exalumno contando su cambio laboral, sin mencionar cifras de empleabilidad garantizada.
   *(pilar: testimonios de exalumnos)*

3. **"Tip rápido: el error más común al empezar en [área técnica]"** — post de tips, tono
   cercano y directo ("vos podés evitarlo así"), sin mencionar precios de cursos.
   *(pilar: tips rápidos del área)*

## Paso 3 — Verificación contra el perfil

| Criterio del perfil | Cumplido |
|---|---|
| Tono cercano y motivador, sin tecnicismos | ✅ |
| No promete empleo garantizado | ✅ (idea 2 evita esa afirmación explícitamente) |
| No menciona precios de cursos | ✅ |
| Se apoya en los 3 pilares de contenido definidos | ✅ (una idea por pilar) |

## Resultado

**Criterio de éxito de la Fase 0 cumplido:** el agente genera contenido que respeta el perfil y
las restricciones del cliente sin que haya que recordárselas en cada prompt.

## Nota

Este test usó datos **ficticios** de CEDITE. Cuando el brief real esté disponible
(historia PFMGN-69), reemplazar `clientes/cedite-test/` por el cliente real y repetir la
validación con datos verdaderos antes de dar por cerrada la Fase 0 en producción.
