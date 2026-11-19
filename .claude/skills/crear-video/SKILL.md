---
name: crear-video
description: Crea un video desde cero, SIN material de base, a partir de una descripción — se arma como una composición HTML/CSS (con el kit de marca del cliente y, si se quiere, sus imágenes reales) y se renderiza a MP4 con HyperFrames. Muestra el PLAN ESCENA POR ESCENA para que el humano apruebe o deje notas antes de exportar. Todo corre en la computadora; nunca publica ni modifica las imágenes originales.
argument-hint: <cliente> "<descripción de la idea>" [formato=reel|historia|cuadrado] [duracion=15] [imagenes=a.jpg,b.png]
tools: Read, Write, Edit, Glob, Bash, Skill, AskUserQuestion
---

# /crear-video

Produce un video **sin filmación previa**: la idea se describe en palabras y el video se construye como
una página HTML/CSS animada (títulos, textos, formas, fondos, fotos del cliente) que se renderiza a MP4.
Es la contracara de `/editar-video` (que parte de un video en bruto) y usa el mismo ciclo de planes,
versiones y aprobación, así que **aparece en la pestaña Videos de Postagent** junto a los demás.

## Uso

```
/crear-video <cliente> "<descripción>" [formato=reel|historia|cuadrado] [duracion=15] [imagenes=a.jpg,b.png]
```

- `<descripción>`: de qué va el video, el tono, qué mensaje y qué llamado a la acción. Cuanto más
  concreto, mejor. Todo dato que no esté confirmado (precios, promos, plazos) va como **POR CONFIRMAR**.
- `formato`: `reel` y `historia` son 9:16 (1080×1920, por defecto `reel`); `cuadrado` es 1:1 (1080×1080).
- `duracion`: segundos totales (por defecto 15; máximo 60).
- `imagenes`: archivos de `clientes/<cliente>/assets/fotos/` o `assets/identidad/` que se pueden usar.
  Si no se indican, se eligen de ahí con criterio y se declara cuáles.

## Material permitido (misma prioridad que las piezas gráficas)

1. **Fotos y logos reales del cliente** (`assets/fotos/`, `assets/identidad/`): se **copian** al proyecto
   del video; el original no se toca.
2. **Solo diseño**: tipografía, color, formas, degradados, íconos dibujados en SVG/CSS. Suele alcanzar.
3. **Imagen generada con IA**: excepcional, bajo las tres condiciones de `CLAUDE.md`, siempre declarada
   como IA, y nunca para mostrar personas, productos o instalaciones del cliente como si fueran reales.

Nunca se inventan testimonios, resultados, precios ni stock. No se usan imágenes ni música sin
derechos claros. Personas reconocibles o menores: respetar los consentimientos del `perfil.md`.

## Procedimiento

1. **Leer al cliente**: `perfil.md` (tono, público, qué nunca hacer) y su kit de marca
   (`clientes/<cliente>/marca/marca.json` y `marca.css`: colores, tipografías, logo, reglas). Si no hay
   kit, avisar y proponer correr `node herramientas/marca/marca.mjs init <cliente>` antes de seguir.

2. **Preparar HyperFrames**: leer el skill `/hyperframes` (punto de entrada) y el de composición
   (`hyperframes-core`) y verificar que la herramienta esté disponible. **Si falta instalar algo, decir
   qué y pedir permiso antes** (`AskUserQuestion`); no seguir sin eso.

3. **Armar el plan** (rol de director creativo), con un **gancho en los primeros 3 s**, una novedad
   visual cada 3–5 s, un solo mensaje y un cierre con llamado a la acción y logo. Guardarlo en
   `clientes/<cliente>/assets/edicion/<slug>.v1.plan.json`:
   ```json
   {
     "cliente": "<cliente>", "slug": "<slug>", "version": 1, "tipo": "html",
     "formato": "reel", "duracion": 15, "aprobado_total": false,
     "brief": "la descripción original",
     "imagenes": ["fotos/obra-1.jpg"],
     "escenas": [
       { "n": 1, "duracion": 3, "titulo": "TEXTO CORTO", "descripcion": "qué se ve y cómo entra",
         "sonido": "nota (no se mezcla todavía)", "estado": "pendiente", "notas": "" }
     ]
   }
   ```
   `<slug>` en minúsculas, sin espacios ni tildes, con guiones. Las duraciones de las escenas suman
   `duracion`. Los textos sin confirmar van como **POR CONFIRMAR**.

4. **Construir la composición** en `clientes/<cliente>/assets/edicion/<slug>.v1/` (un proyecto de
   HyperFrames con su `index.html`): colores y tipografías **solo del kit de marca**, imágenes copiadas
   a la subcarpeta `assets/` del proyecto, textos dentro de las zonas seguras del formato (margen de
   ~120 px arriba y ~220 px abajo en 9:16, para no quedar bajo la interfaz de Instagram) y sin más de
   dos tipografías. Respetar `reglas` del kit (`sinEmojis`, palabras prohibidas, logo obligatorio).

5. **Revisarlo como crítico antes de mostrar**: validar la composición (`check`/`lint`), sacar
   fotogramas de los momentos clave (`snapshot`) y mirarlos. Después **renderizar una vista previa**
   (borrador de baja calidad, `render --quality draft`) a
   `clientes/<cliente>/assets/edicion/<slug>.v<N>.preview.mp4`: es lo que Postagent reproduce en la pestaña
   Videos para que el humano vea el video mientras se arma. Cada versión nueva lleva su propia vista previa. Corregir texto cortado, contraste bajo,
   elementos fuera de la zona segura, escenas sin novedad y errores de ortografía.

6. **Presentar el plan escena por escena** (duración, qué se ve, texto, animación, imagen usada)
   con los fotogramas y la vista previa (avisar que ya se puede ver en Postagent → Videos), y pedir decisión con `AskUserQuestion`: aprobar todo / dejar notas por escena /
   descartar.
   - Con notas: aplicar solo lo pedido y guardar como **versión nueva** (`v2`, `v3`…: otra carpeta y otro
     `.plan.json`), sin pisar las anteriores. Si una nota es vaga, preguntar escena, qué cambiar y cómo.
   - Las preferencias que no son un arreglo puntual se anotan en `perfil.md` solo si el humano lo pide.

7. **Exportar solo con aprobación total**: cuando el humano diga que está todo aprobado, marcar
   `aprobado_total: true` y `estado: "aprobada"` en cada escena de **esa** versión y renderizar a
   `clientes/<cliente>/assets/terminados/<slug>-v<N>.mp4` (H.264, 30 fps, 1080 de ancho). Verificar que
   el archivo existe y dura lo planeado, y agregar una línea en `registro-actividad.log`.

8. **Entregar**: el video, un fotograma de portada sugerido y el siguiente paso. Reel o historia:
   `/crear-reel` o `/crear-historias` toma ese archivo.

## Reglas

- **Proponer → revisar → ejecutar**: no se exporta el video final sin la aprobación de todas las escenas.
- Nunca publicar, subir ni compartir el video desde este skill.
- Todo corre en la computadora: no usar servicios web de generación de video ni subir material a ningún lado.
- Un plan aprobado es inmutable; un cambio genera una versión nueva.
- No tocar `assets/fotos/` ni `assets/identidad/` (solo se leen y se copian).
