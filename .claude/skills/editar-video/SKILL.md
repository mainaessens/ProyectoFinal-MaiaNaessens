---
name: editar-video
description: Edita el video en bruto de un cliente (reel o historia) con Moviola, el editor local de la agencia — corta silencios y repeticiones, subtitula palabra a palabra, agrega títulos animados con la hoja de marca del cliente, y muestra el PLAN ESCENA POR ESCENA para que el humano apruebe o deje notas antes de exportar el video terminado. Todo corre en la computadora; nunca modifica el bruto ni publica.
tools: Read, Write, Glob, Bash, AskUserQuestion
---

# /editar-video

Convierte un video en bruto en un video terminado, vertical y con la marca del cliente, **con el
humano aprobando el plan escena por escena antes de exportar**.

## Uso

```
/editar-video <cliente> <bruto> [instrucciones]
```

- `<bruto>`: archivo en `clientes/<cliente>/assets/videos/` (ej. `taller.mov`).
- `[instrucciones]`: de qué va, qué palabra resaltar, qué no querés («sin emojis», «sin zoom»).
  Cuanto más se cuenta, mejor sale.

El trabajo lo hace el subagente **`editor-video`** (método en
`.claude/referencias/guia-edicion-video.md`). La herramienta es `herramientas/moviola/moviola.mjs`;
se invoca desde `agencia/` como `node herramientas/moviola/moviola.mjs <comando> <cliente> ...` y
devuelve siempre JSON.

## Procedimiento

1. **Verificar el equipo**: `moviola.mjs doctor`. Si `listo_para_editar` es `false`, decir qué
   falta y cómo instalarlo (`docs/editor-de-video.md`) y **pedir permiso antes de instalar nada**.
   No seguir sin FFmpeg y Whisper.

2. **Preparar el cliente**: `moviola.mjs preparar <cliente>` crea `assets/{referencias,edicion,
   terminados}` y, si no existe, `hoja-de-marca.json` en borrador.

3. **Hoja de marca** (`clientes/<cliente>/hoja-de-marca.json`): si está en *borrador*, completarla
   desde el `perfil.md` (paleta → `colores.texto/resalta/contorno`; tipografías → `fuentes`) y
   presentarla para confirmar. Si el cliente pasó 3–5 reels de referencia, bajarlos con
   `bajar-referencia <cliente> <url>` (solo https de Instagram/TikTok/YouTube, **solo para
   estudiar estilo y ritmo**) y anotar en `notas` qué se toma como mecanismo. Las tipografías de
   pago tienen que estar instaladas en la computadora; si no, avisar que se usará una parecida.

4. **Conocer el bruto**: `sondear` (duración, resolución, audio), `transcribir` (Whisper local; el
   video no sale de la computadora) y `silencios` (tramos que se conservan). Si el bruto es
   horizontal, avisar que se recorta al centro.

5. **Armar el plan** (rol de director creativo). Leer la transcripción completa y decidir:
   la **última toma buena** de cada frase, qué cortar, el **gancho de 0–3 s**, qué título refuerza
   el gancho, las **palabras clave** a resaltar, y dónde hay una novedad cada 5–15 s. Escribir
   `assets/edicion/<slug>.v1.plan.json`:
   ```json
   {
     "cliente": "<cliente>", "slug": "<slug>", "version": 1,
     "bruto": "assets/videos/<archivo>", "formato": "reel", "aprobado_total": false,
     "transcripcion": "assets/edicion/<archivo-sin-ext>.transcripcion.json",
     "subtitulos": { "activo": true, "palabras_clave": ["..."] },
     "escenas": [
       { "n": 1, "origen": { "inicio": 1.0, "fin": 5.0 }, "titulo": "TEXTO CORTO",
         "titulo_duracion": 2.5, "descripcion": "por qué existe esta escena",
         "sonido": "nota (no se mezcla todavía)", "estado": "pendiente", "notas": "" }
     ]
   }
   ```
   Validar con `validar <cliente> <plan>`. Los textos que no estén confirmados (promos, precios,
   datos) van como **POR CONFIRMAR**; no se inventan.

6. **Revisar como crítico** (ver la guía): `renderizar <cliente> <plan> --preview` y extraer
   fotogramas de los momentos clave con `fotograma` para mirarlos. Corregir lo que falle (texto
   cortado, zonas no seguras, subtítulos sobre la cara, más de 15 s sin novedad, errores de
   transcripción) **antes** de mostrar.

7. **Presentar el plan escena por escena** al humano: tiempo (bruto → final), qué se dice, título,
   animación y nota de sonido, junto con el preview y los hallazgos abiertos. Pedir decisión con
   `AskUserQuestion`: aprobar todo / dejar notas por escena / descartar.
   - Con notas: aplicar solo lo pedido, guardar como **versión nueva** (`v2`, `v3`…) y volver a
     presentar. Si una nota es muy vaga («no me gusta»), pedir escena, qué cambiar y cómo.
   - Las preferencias que no son un arreglo puntual se guardan en `hoja-de-marca.json`
     (`notas`/`nunca`) para el próximo video.

8. **Exportar solo con aprobación total**: cuando el humano diga que está todo aprobado, marcar
   `aprobado_total: true` y `estado: "aprobada"` en cada escena de **esa** versión y ejecutar
   `renderizar <cliente> <plan>`. La herramienta se niega si falta algo. Sale
   `assets/terminados/<slug>-v<N>.mp4` y una línea en `registro-actividad.log`.

9. **Entregar**: el video, un fotograma de portada sugerido (`fotograma`) y el siguiente paso:
   - Reel: `/crear-reel <cliente> <#|slug>` toma ese archivo como `video` del plan (caption,
     portada y horario los resuelve `community-manager`).
   - Historia: `/crear-historias <cliente> <#|slug>` con ese archivo.

## Qué hace hoy y qué no

| Hace (Moviola) | No hace todavía |
|---|---|
| Cortes de silencios y tomas, vertical 9:16 1080×1920 | Mezclar efectos de sonido (queda como nota en el plan) |
| Subtítulos palabra a palabra con palabras clave | Zoom, 3D, texto detrás de la persona, transiciones elaboradas |
| Títulos con animación de entrada y salida | Calcar el ritmo de un video de referencia automáticamente |
| Normaliza el audio a −14 LUFS | Variantes automáticas con otros ganchos |

Para motion graphics avanzados (transiciones, animación de tipografía, 3D, bloques del registro)
está instalado el plugin **HyperFrames** (`/hyperframes`): usarlo **solo si el humano lo pide**
para esa pieza, y el resultado pasa por el mismo plan y la misma aprobación.

## Reglas

- **Nunca modificar ni borrar el bruto** (`assets/videos/`). Todo trabajo va en `assets/edicion/`.
- **Proponer → revisar → ejecutar**: el video final no se exporta sin la aprobación de todas las
  escenas (barrera técnica en la herramienta).
- Nunca publicar, subir ni compartir el video desde este skill: eso es `/crear-reel` con su propio OK.
- Todo corre en la computadora: no usar servicios web de edición ni subir el video a ningún lado.
- Personas reconocibles o menores en el video: respetar los consentimientos del `perfil.md`.
- Un plan aprobado es inmutable; un cambio genera una versión nueva.
- Material de referencia ajeno: solo para estudiar, nunca para republicar.
