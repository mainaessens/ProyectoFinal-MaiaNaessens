---
name: crear-post
description: Arma uno o varios posteos de la campaña mensual aprobada — hook + caption por red + pieza gráfica real en Canva (exportada a assets/exports/) + horario — revisando diseño por diseño con aprobación humana. Se invoca por número o nombre de posteo, o con "todos" para el lote completo. Genera un .plan.json por pieza; solo publica en redes si existe el conector de publicación y el usuario da un OK explícito por pieza. Si Canva no está disponible, cae a modo plan (diseno_pendiente) sin bloquear el pipeline.
tools: Read, Write, Bash, AskUserQuestion, mcp__canva__*, mcp__gworkspace__*
---

# /crear-post

Convierte filas de la campaña mensual aprobada en piezas listas, una por una, y las deja
planificadas (o publicadas, si hay conector y el humano lo aprueba).

## Uso

```
/crear-post <cliente> <#|slug|todos>
/crear-post <cliente> "<tema libre>"
```

- `<#|slug>`: número o nombre del posteo en `clientes/<cliente>/calendario-editorial.md`
  (ej: `3` o `testimonio-sofia`). Debe existir en una campaña aprobada.
- `todos`: todos los posteos del mes que aún no tengan un `.plan.json` aprobado.
- `"<tema libre>"`: un post fuera de campaña (se pide confirmar que no es parte del calendario).

## Procedimiento (por cada posteo; en `todos`, secuencial)

1. **Resolver el posteo**: leer `calendario-editorial.md` (la ficha de la sección `## Desarrollo
   de piezas` es el punto de partida aprobado: no rehacerla salvo que el usuario pida cambios) y
   tomar fecha, red, formato, tema,
   hook y CTA de la fila. Si el número/nombre no existe o es ambiguo, listar las filas y
   preguntar. Si el calendario no está aprobado, avisar y detenerse.

2. **Leer el perfil** (`perfil.md`): tono, pilares, restricciones, *reglas de estilo y
   validación*, redes, plantillas de Canva. Leer también `.claude/referencias/criterios-editoriales.md`
   y, según el formato, `guia-formatos.md` (carrusel: progresión placa a placa).

3. **Ficha de idea, hook y caption base** (copywriter):
   - Ficha corta: objetivo, público, insight, hipótesis (*si comunicamos X desde Y en Z,
     esperamos W porque V*) y KPI principal. Lo que no esté confirmado va marcado
     **SUPUESTO / POR CONFIRMAR**.
   - **2–3 hooks sustancialmente distintos**; elegir uno y justificarlo.
   - Para un **carrusel**: describir cada placa (título, texto final, función, idea visual,
     elemento real requerido) siguiendo la guía; para un post simple, el foco y el CTA único.
   - Correr `checklist-marca.ps1` sobre el caption y mostrar las alertas (no bloquea, informa).
   - **Autoevaluar** la pieza con `.claude/referencias/autoevaluacion.md`: menos de 16/20 o una
     falla de exactitud/seguridad → reescribir antes de seguir.

4. **Adaptar el caption por red** (subagente `community-manager`).

5. **Diseñar la pieza** (subagente `disenador`), con la prioridad foto real del cliente
   (`assets/fotos`) → plantilla Canva sin foto → imagen IA. Usar las plantillas maestras del
   cliente (nunca brand kits de otros clientes). Si Canva no está disponible: modo plan
   (`diseno_pendiente: true`), sin bloquear el flujo.

6. **Revisar el diseño**: analizar la pieza generada contra el perfil (paleta, tipografía,
   texto sin errores, que el hook se lea, formato correcto para la red) y listar los
   hallazgos antes de mostrársela al humano.

7. **Sugerir horario** (lógica de `agents/horario-optimo.md`) si hay `google_calendar_id`; si la
   fila ya trae fecha de la campaña, proponer esa y solo ajustar la hora.

8. **Presentar este posteo** (ficha, hooks considerados y elegido, captions, imagen/link de Canva,
   horario, puntaje de autoevaluación con sus criterios flojos, datos POR CONFIRMAR, hallazgos) y pedir
   decisión con `AskUserQuestion`: aprobar / pedir cambios / rechazar.
   - En modo `todos` se presenta **un posteo por vez** y no se avanza al siguiente sin decisión.
   - Si pide cambios: volver al paso 3, 4 o 5 y presentar una versión nueva, sin pisar la anterior.

9. **Si aprueba**:
   - **Exportar de Canva** el diseño final (`get-export-formats` + `export-design`, PNG para
     post/historia; todas las páginas para carrusel) y descargarlo a
     `clientes/<cliente>/assets/exports/<fecha>-<slug>.<ext>`.
   - Generar `clientes/<cliente>/historial/<fecha>-<slug>.plan.json`:
     ```json
     {
       "cliente": "<cliente>",
       "fecha_creacion": "<hoy>",
       "aprobado": true,
       "numero_post": 3,
       "red": "<red o lista>",
       "hook_texto": "...",
       "caption": { "instagram": "...", "facebook": "..." },
       "diseno": {
         "fuente": "foto_cliente | plantilla_sin_foto | glif",
         "plantilla_canva": "<id o nombre>",
         "design_id": "<id del diseño final>",
         "archivo_exportado": "assets/exports/<fecha>-<slug>.png",
         "diseno_pendiente": false
       },
       "objetivo": "...", "kpi": "...", "hipotesis": "...",
       "autoevaluacion": { "puntaje": 18, "abiertos": [] },
       "fecha_programada": "<horario aprobado>",
       "estado": "listo_para_publicar | listo_para_publicar_cuando_exista_conector"
     }
     ```
   - Marcar el posteo como diseñado en `calendario-editorial.md`.

10. **Publicar en Instagram (opcional, por pieza)**: solo si el conector `instagram` está
    registrado y el cliente tiene `ig_user_id` en `.claude/instagram-cuentas.json`
    (guía: `docs/conectar-instagram.md`). Pedir un OK explícito y separado ("publicar esta pieza
    en Instagram ahora / el <día> a las <hora>"). Luego, siempre pasando `cliente` y `plan`:
    1. `subir_archivo_publico` → devuelve la(s) URL(s) https pública(s) del/los archivo(s)
       exportado(s) (una por placa, en orden, si es carrusel).
    2. `publicar_imagen`, `publicar_carrusel` (`image_urls` en orden de placa) o `publicar_reel`
       **sin** `confirmar` → simulacro; mostrar al usuario qué se publicaría.
    3. Con el OK, repetir con `confirmar:true`. El caption sale del plan aprobado, no del chat.
    La API publica al instante: para una fecha futura, no llamar hasta ese momento (rutina
    programada); el conector se niega a publicar antes de `fecha_programada` salvo
    `ignorar_fecha_programada:true`, que solo se usa si el usuario pide publicar ya.
    El conector registra `<plan>.publicado.json` y la línea en `registro-actividad.log`; el plan
    aprobado no se modifica. Facebook no tiene conector todavía.
    - **Sin conector o sin cuenta configurada**: no intentar publicar. Dejar el plan en
      `listo_para_publicar_cuando_exista_conector`, con el archivo exportado listo, y decirlo
      explícitamente.

11. **Cierre**: resumen de lo hecho (posteos aprobados, exportados, publicados) y de lo que
    quedó pendiente.

## Reglas

- Proponer → revisar → ejecutar, siempre: ningún `.plan.json` con `aprobado: true` sin OK
  explícito del usuario sobre texto, diseño y horario de esa pieza.
- Aprobar el lote no es aprobar la publicación: la publicación requiere su propio OK por pieza.
- Nunca llamar a un conector de publicación no registrado.
- Un `.plan.json` aprobado es inmutable en contenido: un cambio genera un archivo nuevo.
- Nunca usar brand kits de clientes de la cuenta de Canva.
