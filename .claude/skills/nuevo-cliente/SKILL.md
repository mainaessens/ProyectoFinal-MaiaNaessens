---
name: nuevo-cliente
description: Da de alta un cliente nuevo. Con una URL de Drive, lee el contenido, propone (y tras aprobación aplica) un orden de la carpeta, descarga todo el material audiovisual a assets/, genera el perfil.md desde el brief y el manual, y deja listas las 3 plantillas maestras de Canva (las toma del Drive si existen; si no, ofrece generarlas con Canva o con Claude Design). Sin URL, arma el perfil con lo que indique el usuario en el chat.
tools: Read, Write, Glob, Bash, AskUserQuestion, mcp__gworkspace__*, mcp__canva__*, mcp__instagram__ver_cuenta, mcp__instagram__recopilar_estadisticas
---

# /nuevo-cliente

Da de alta un cliente nuevo de la agencia.

## Uso

```
/nuevo-cliente <nombre-cliente> [url-drive-opcional]
```

- `<nombre-cliente>`: nombre corto, en minúsculas y sin espacios (guiones si hace falta).
- `[url-drive-opcional]`: carpeta de Google Drive del cliente. Si se da, dispara el flujo
  completo (secciones A a D). Si no, el perfil se arma solo con lo que diga el usuario.

## Procedimiento general

1. **Verificar que no exista** `clientes/<nombre-cliente>/`. Si existe, avisar y detenerse; no
   sobrescribir sin confirmación explícita.
2. **Crear la estructura** copiando `clientes/plantilla/`:
   ```
   clientes/<nombre-cliente>/
   ├── perfil.md
   ├── calendario-editorial.md
   ├── aprendizajes.md
   ├── historial/
   ├── assets/
   │   ├── fotos/
   │   ├── videos/
   │   ├── ia/             (imágenes generadas con Glif, reutilizables)
   │   ├── exports/        (piezas exportadas de Canva)
   │   ├── referencias/    (reels de referencia, solo para estudiar estilo)
   │   ├── edicion/        (planes de edición, transcripciones y previews)
   │   └── terminados/     (videos finales editados con Moviola)
   └── registro-actividad.log
   ```
3. **Con `url-drive`**: ejecutar las secciones A → D. **Sin `url-drive`**: preguntar (no
   asumir) sector, público, tono, 2-3 pilares y qué NO publicar, y pasar directo a la sección D.
4. **Presentar el perfil completo** y esperar aprobación antes de darlo por definitivo.
4b. **Diagnóstico inicial de Instagram** (sección E): el community-manager analiza las
   estadísticas reales de la cuenta, con o sin Drive. Es la base del primer plan de contenido.
5. **Crear `registro-actividad.log`** con la línea de alta: `[<fecha>] Cliente <nombre-cliente> dado de alta.`
6. Resumir qué quedó hecho, qué quedó pendiente, y sugerir el siguiente paso:
   `/campania-mensual <cliente> <mes> <objetivo>`.

   Orden de las secciones: A → B → C → D → **E (diagnóstico de Instagram)**.

## A. Leer y ordenar el Drive

1. Extraer el ID de carpeta de la URL y listar **todo** el contenido (recursivo) con `gworkspace`.
2. Clasificar cada archivo a su mejor criterio:
   - **Brief** y **manual de marca** (docs/PDF; por nombre y contenido, no solo por nombre exacto).
   - **Identidad visual**: logos, paletas, tipografías, plantillas Canva (links `canva.com`).
   - **Fotos** y **videos** (por tipo MIME).
   - **Otros documentos** (institucionales, contratos, etc.).
3. **Proponer un orden** de la carpeta con esta estructura objetivo:
   ```
   <cliente>/
   ├── Brief y manual/        ├── fotos/
   ├── Identidad visual/      ├── videos/
   │   └── plantillas-canva/  └── Otros/
   ```
   Mostrar una tabla `archivo actual → destino`. Marcar los archivos que no se pudieron
   clasificar con seguridad.
4. **Parada obligatoria**: pedir aprobación (`AskUserQuestion`: aplicar / ajustar / no tocar el
   Drive). Solo con OK explícito mover o renombrar archivos en Drive.
   - Nunca borrar ni enviar a la papelera nada del cliente.
   - Si no hay herramienta para mover archivos, no improvisar: dejar el plan de orden en
     `clientes/<cliente>/orden-drive.md` para que el humano lo aplique.
   - Si el usuario elige no tocar el Drive, seguir con el contenido tal como está.

## B. Descargar el material audiovisual

1. Descargar todas las fotos y videos (de `fotos/`, `videos/` y de cualquier otra carpeta donde
   se hayan clasificado) a `clientes/<cliente>/assets/fotos` y `assets/videos`.
   - Con instalación CLI: `.claude/scripts/descargar-assets.ps1 -Cliente <cliente>`.
   - Con el conector de la plataforma: usar `download_file_content` por archivo.
2. No duplicar: omitir archivos que ya existan con el mismo nombre.
3. Informar cantidad por tipo y tamaño total. Si no hay material, decirlo: las piezas usarán
   plantilla sin foto.

## C. Plantillas maestras de Canva (post, carrusel, historia)

1. Buscar plantillas ya hechas: links de Canva o archivos en `Identidad Visual/plantillas-canva`.
   Si están las 3, registrarlas en el perfil tal cual (no regenerar).
2. Si faltan una o más, **preguntar con `AskUserQuestion`** cómo generarlas:
   - **Canva** (recomendada): crear las faltantes con el conector, **sin `brand_kit_id`**,
     describiendo paleta y tipografía del cliente en el prompt (nunca usar brand kits de otros
     clientes de la cuenta).
   - **Claude Design**: diseñarlas como Artifact de diseño y, si hace falta, importarlas a
     Canva después con `import-design-from-url`.
   - **Omitir por ahora**: dejar "pendiente" en el perfil; `/crear-post` caerá a modo plan.
3. Mostrar cada plantilla (link de edición) al usuario para su revisión antes de registrarla.
4. Guardar nombre/ID/link de las 3 en la sección "Plantillas maestras" del perfil.

## D. Perfil

1. Leer el brief y el manual. Extraer y proponer: tono, paleta, tipografías, público, pilares,
   restricciones, competidores. **No inventar** más allá del material.
2. Marcar qué se infirió y qué quedó pendiente (redes activas, Meta Ads, Jira, Calendar).
3. Si el material contradice al usuario en el chat, priorizar al usuario y señalar la
   contradicción.
4. El perfil sigue el formato de `clientes/plantilla/perfil.md`, incluyendo la sección
   "Estado del alta" (Drive ordenado, assets descargados, plantillas Canva).

## E. Diagnóstico inicial de Instagram (community-manager)

Antes de planificar el primer mes hay que saber cómo rinde la cuenta hoy.

1. **Conectar la cuenta**: preguntar el `ig_user_id` (o dónde encontrarlo, ver
   `docs/conectar-instagram.md`) y registrarlo en `.claude/instagram-cuentas.json` bajo el
   cliente. **Nunca pedir ni escribir el token en el chat o en archivos**: lo carga el humano como
   variable de entorno (`INSTAGRAM_TOKEN_<CLIENTE>` o `INSTAGRAM_ACCESS_TOKEN`), con el permiso
   `instagram_manage_insights` además de los de publicación.
2. **Invocar `/analisis-cuenta <cliente> baseline`** (subagente `community-manager`): trae los
   últimos 90 días con todo lo que entrega la API y produce `analisis/baseline-<fecha>.md` con
   decisiones para el primer plan. El usuario lo valida ahí mismo.
3. **Si no se puede** (cuenta sin conectar, token sin permiso de insights, cuenta nueva sin
   publicaciones o con menos de 100 seguidores): decirlo, dejar el estado como **pendiente** en el
   perfil ("Diagnóstico de Instagram") y avanzar. Sin diagnóstico, el primer plan se marca como
   *hipótesis sin datos propios* y debe revisarse al cerrar el mes (`/analisis-cuenta` mensual).

## Reglas

- Nunca crear tareas en Jira ni eventos en Calendar desde este skill.
- Nunca sobrescribir un cliente existente sin confirmación explícita.
- Nunca modificar el Drive del cliente sin aprobación del plan de orden, ni borrar nada.
- Nunca usar brand kits de Canva; las plantillas se generan describiendo la marca en el prompt.
- Nunca publicar nada. El diagnóstico de Instagram es solo lectura.
- Nunca pedir ni guardar tokens de Meta.
