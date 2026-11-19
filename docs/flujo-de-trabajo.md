# Flujo de trabajo de punta a punta

Cada paso termina con una parada humana. Lo que sigue es el recorrido de un cliente nuevo.

```
/nuevo-cliente ─► /campania-mensual ─► /crear-post (o /crear-reel) ─► publicar ─► reporte / cierre
   OK humano          OK humano             OK por pieza              OK por pieza
```

## 1. Alta del cliente: `/nuevo-cliente <nombre> <url-drive>`
1. Lee todo el Drive y clasifica: brief, manual de marca, identidad visual, fotos, videos, otros.
2. **Parada:** propone el orden de carpetas (tabla archivo → destino). Solo con OK mueve archivos;
   nunca borra.
3. Descarga fotos y videos a `clientes/<c>/assets/`.
4. Si faltan las 3 plantillas maestras de Canva: **parada** para elegir Canva, Claude Design u omitir.
5. Genera `perfil.md` citando la fuente de cada dato; **parada** para aprobarlo.

## 2. Campaña del mes: `/campania-mensual <cliente> <mes> <objetivo>`
Tendencias + historial → tabla numerada (`#`, slug, fecha, red, formato, tema, hook, CTA) **más el
desarrollo de cada pieza** (guion de cada reel, placas de cada carrusel, secuencia de cada historia).
**Parada:** aprobación de la tabla y del desarrollo. Guarda `calendario-editorial.md` (tabla +
sección "Desarrollo de piezas"). Si el cliente la
aprueba, ofrece: un posteo por número o nombre, todos juntos, o más tarde.

## 3. Cada pieza: `/crear-post <cliente> <#|slug|todos>`
El diseño lo hace el `disenador` con **Claude Design (código)** por defecto o **Canva**; se itera en
Postagent → Diseños. Ver `docs/diseno-claude-design.md`.

1. Toma la fila del calendario, escribe el hook y el caption por red, corre `checklist-marca.ps1`.
2. Diseña con la plantilla maestra del cliente (foto real → plantilla sin foto → imagen IA).
3. Revisa el diseño contra el perfil (paleta, tipografía, texto, formato).
4. **Parada por pieza:** aprobar, pedir cambios (versión nueva, sin pisar la anterior) o rechazar.
   En `todos`, se presenta una pieza por vez.
5. Al aprobar: exporta el diseño a `assets/exports/` y genera el `.plan.json` aprobado.

`/crear-reel` es igual pero con guion y video real del cliente; si no hay video, lo declara.

## 4. Publicación en Instagram (conector propio)
Requiere `.claude/instagram-cuentas.json` y las variables de entorno (ver [conectar-instagram.md](conectar-instagram.md)).
1. `subir_archivo_publico` → URL(s) https de las imágenes exportadas.
2. `publicar_imagen`, `publicar_carrusel` o `publicar_reel` **sin** `confirmar` → **simulacro**.
3. **Parada:** OK explícito del usuario para esa pieza.
4. Repetir con `confirmar:true`. El caption sale del plan aprobado. Se escribe
   `<plan>.publicado.json` y una línea en `registro-actividad.log`.

La API publica al instante. Para una fecha futura hay que ejecutar este paso a esa hora.

## 5. Seguimiento
`/reporte-semanal` y `/cierre-mensual` registran lo publicado en `historial/` y `aprendizajes.md`,
y alimentan la campaña del mes siguiente.

## Estados de una pieza
`en calendario` → `diseño en curso` → `aprobada (plan.json)` → `exportada` → `publicada (.publicado.json)`.
