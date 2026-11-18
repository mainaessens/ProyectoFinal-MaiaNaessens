---
name: nuevo-cliente
description: Da de alta un cliente nuevo. Con una URL de Drive, lee el contenido, propone (y tras aprobación aplica) un orden de la carpeta, descarga todo el material audiovisual a assets/, genera el perfil.md desde el brief y el manual, y deja lista la base de diseño: el kit de marca para Claude Design (por defecto) y/o las 3 plantillas maestras de Canva (las toma del Drive si existen; si faltan, ofrece todas las opciones: Claude Design, Canva, Claude Design importado a Canva u omitir). Sin URL, arma el perfil con lo que indique el usuario en el chat.
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
   ├── marca/              (kit de marca para Claude Design: marca.json, logo/, fuentes/)
   ├── diseno/             (piezas HTML versionadas: <fecha>-<slug>/vN.html + vN.png)
   ├── assets/
   │   ├── fotos/          (<categoría>/<tema>/, espejo de 03 Fotos del Drive)
   │   ├── videos/         (<categoría>/..., espejo de 04 Videos del Drive)
   │   ├── identidad/      (logos y paleta, espejo de 02 Identidad visual)
   │   ├── ia/             (imágenes generadas con Glif, reutilizables)
   │   ├── exports/        (piezas aprobadas, de Claude Design o Canva)
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

   Orden de las secciones: A → B → C (diseño) → D → E (diagnóstico de Instagram) → **F (subir los datos a Drive)**.

## A. Leer y ordenar el Drive

1. Extraer el ID de carpeta de la URL y listar **todo** el contenido (recursivo) con `gworkspace`.
2. Clasificar cada archivo a su mejor criterio:
   - **Brief** y **manual de marca** (docs/PDF; por nombre y contenido, no solo por nombre exacto).
   - **Identidad visual**: logos, paletas, tipografías, plantillas Canva (links `canva.com`).
   - **Fotos** y **videos** (por tipo MIME).
   - **Otros documentos** (institucionales, contratos, etc.).
3. **Proponer un orden** de la carpeta según la convención de `docs/orden-del-drive.md`
   (léela antes de proponer): `01 Brief y manual`, `02 Identidad visual` (con `logo/` y
   `plantillas-canva/`), `03 Fotos/<categoría>/<tema>`, `04 Videos/<categoría>`, `05 Otros`. La carpeta `06 Agente` la
   crea `/sincronizar-drive` (sección F); no se propone como destino de archivos del cliente.
   Categorías de fotos: trabajos, producto, equipo, local, eventos, varios. De videos: crudos,
   proceso, testimonios, varios. Mostrar una tabla `archivo actual → destino`. Marcar los archivos
   que no se pudieron clasificar con seguridad.
4. **Parada obligatoria**: pedir aprobación (`AskUserQuestion`: aplicar / ajustar / no tocar el
   Drive). Solo con OK explícito mover o renombrar archivos en Drive.
   - Nunca borrar ni enviar a la papelera nada del cliente.
   - Si no hay herramienta para mover archivos, no improvisar: dejar el plan de orden en
     `clientes/<cliente>/orden-drive.md` para que el humano lo aplique.
   - Si el usuario elige no tocar el Drive, seguir con el contenido tal como está.

## B. Descargar el material audiovisual

1. Descargar fotos, videos e identidad visual a `clientes/<cliente>/assets/{fotos,videos,identidad}`
   respetando el árbol del Drive (nombres normalizados), según `docs/orden-del-drive.md`.
   - Con instalación CLI: `.claude/scripts/descargar-assets.ps1 -Cliente <cliente> -DryRun`
     y luego sin `-DryRun`.
   - Con el conector de la plataforma: `download_file_content` por archivo, con las mismas reglas
     (mismas rutas locales, normalización de nombres, tipos por sección).
2. No duplicar: el script usa `assets/.drive-manifest.json` (id de Drive → ruta + md5). Con el
   conector, omitir los archivos que ya existan en la ruta destino con el mismo contenido.
3. Informar cantidad por tipo y tamaño total. Si no hay material, decirlo: las piezas usarán
   plantilla sin foto.

## C. Diseño: kit de marca y plantillas (todas las opciones)

El cliente necesita una base de diseño para que las piezas salgan siempre con su identidad. Hay
cuatro caminos y se pueden combinar.

1. **Ver qué ya existe**: links de Canva o archivos en `02 Identidad visual/plantillas-canva` del
   Drive, un kit en `clientes/<cliente>/marca/`, y lo que diga el brief sobre cómo trabaja el
   cliente su diseño. Lo que ya está hecho se registra tal cual; no se regenera.

2. **Preguntar con `AskUserQuestion`** (selección múltiple) qué opciones usar para lo que falte:
   - **Claude Design (código) — recomendada, es el motor por defecto**: kit de marca en HTML/CSS
     con control de marca y render a PNG, que se itera en Faro (pestaña Diseños).
   - **Canva — crear las 3 plantillas maestras** (post, carrusel, historia) con el conector.
   - **Claude Design como Artifact visual e importarlo a Canva**: se diseña la plantilla como
     Artifact de diseño y se importa a Canva con `import-design-from-url`, para que el cliente
     o el equipo la sigan editando allí.
   - **Omitir por ahora**: queda "pendiente" en el perfil; `/crear-post` cae a modo plan hasta
     que se resuelva.
   Marcar **Claude Design** y **Canva** a la vez es válido: Claude Design queda como motor por
   defecto y Canva como alternativa lista para usar.

3. **Si se elige Claude Design (código)** — crear el kit de marca:
   - `node herramientas/marca/marca.mjs init <cliente>`.
   - Completar `clientes/<cliente>/marca/marca.json` con la paleta (hex), las tipografías y el
     logo (copiar de `assets/identidad/` a `marca/logo/` y `marca/fuentes/`), y las reglas de voz
     (las **restricciones** del brief pasan a `reglas.prohibidas`). Lo que el brief y el manual no
     digan se marca como supuesto y se avisa; no se inventa.
   - `marca.mjs build <cliente>` y una pieza de prueba (`marca.mjs nueva <cliente> prueba feed-cifra`
     + `render`): mostrar el PNG para que el humano valide la marca antes de seguir.
   - Detalle: `docs/diseno-claude-design.md`.

4. **Si se elige Canva — crear las plantillas maestras que falten** (post 1:1, carrusel 4:5 con
   varias páginas, historia 9:16):
   - Con el conector de Canva (`generate-design` y `create-design-from-candidate`), **sin
     `brand_kit_id`**: describir en el prompt la paleta (hex), las tipografías, el tono y el estilo
     del cliente sacados del brief y el manual. **Nunca** usar los brand kits de otros clientes de
     la cuenta de Canva.
   - Subir el logo del cliente (`create-upload-url`) y usarlo en la plantilla.
   - Una plantilla por formato, con texto de ejemplo claramente marcado, zonas seguras para
     historias y espacio para una foto real del cliente.
   - Mostrar cada plantilla (link de edición) al usuario para su revisión **antes** de registrarla.
   - Si Canva no está disponible: decirlo, dejar las plantillas como pendientes y ofrecer Claude
     Design.

5. **Si se elige Claude Design como Artifact → Canva**: diseñar cada plantilla como Artifact de
   diseño con la identidad del cliente, mostrarla para revisión, importarla a Canva con
   `import-design-from-url` y registrar el link de edición.

6. **Registrar en el perfil** (`Identidad visual`): `Motor de diseño` (`claude-design` si se creó
   el kit, `canva` si solo hay plantillas de Canva), la ruta del kit de marca, y el nombre, ID y
   link de las 3 plantillas de Canva si se hicieron.

## D. Perfil

1. Leer el brief y el manual. Extraer y proponer: tono, paleta, tipografías, público, pilares,
   restricciones, competidores. **No inventar** más allá del material.
2. Marcar qué se infirió y qué quedó pendiente (redes activas, Jira, Calendar).
3. Si el material contradice al usuario en el chat, priorizar al usuario y señalar la
   contradicción.
4. El perfil sigue el formato de `clientes/plantilla/perfil.md`, incluyendo la sección
   "Estado del alta" (Drive ordenado, assets descargados, kit de marca y/o plantillas de Canva).

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

## F. Subir los datos del cliente a Drive (`06 Agente`)

Cuando el perfil está aprobado y el diagnóstico hecho (o declarado pendiente), ejecutar
**`/sincronizar-drive <cliente>`**: crea la carpeta `06 Agente` dentro de la carpeta de Drive de
la que se descargó el material y sube allí `perfil.md`, `calendario-editorial.md`,
`aprendizajes.md`, `analisis/`, `historial/` y lo demás que genere el alta. Marcar "Datos subidos
a Drive" en la sección "Estado del alta" del perfil. Si el conector de Drive no tiene permiso de
escritura, dejarlo como **pendiente** y seguir.

## Reglas

- Nunca crear tareas en Jira ni eventos en Calendar desde este skill.
- Nunca sobrescribir un cliente existente sin confirmación explícita.
- Nunca modificar el Drive del cliente sin aprobación del plan de orden, ni borrar nada.
- Nunca usar brand kits de Canva; las plantillas se generan describiendo la marca en el prompt.
- Nunca publicar nada. El diagnóstico de Instagram es solo lectura.
- Nunca pedir ni guardar tokens de Meta.
