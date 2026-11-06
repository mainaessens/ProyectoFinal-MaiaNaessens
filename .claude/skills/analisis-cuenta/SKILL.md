---
name: analisis-cuenta
description: Análisis de las estadísticas reales de la cuenta de Instagram de un cliente, hecho por el community-manager con todo lo que entrega la API (publicaciones, alcance, guardados, compartidos, retención de reels, audiencia, horas activas, seguidores, competidores). Se hace al dar de alta al cliente (línea base de 90 días) y MES A MES antes de planificar el siguiente. Termina en una lista de decisiones que /campania-mensual está obligado a usar. Solo lectura sobre Instagram.
tools: Read, Write, Glob, AskUserQuestion, mcp__instagram__ver_cuenta, mcp__instagram__perfil_cuenta, mcp__instagram__listar_publicaciones, mcp__instagram__insights_publicacion, mcp__instagram__insights_cuenta, mcp__instagram__audiencia, mcp__instagram__benchmark_competidor, mcp__instagram__recopilar_estadisticas
---

# /analisis-cuenta

Convierte los números reales de Instagram en **decisiones** para el plan de contenido.

## Uso

```
/analisis-cuenta <cliente> [AAAA-MM | baseline]
```

- `<cliente>`: carpeta en `clientes/<cliente>/`.
- `AAAA-MM`: mes a analizar (análisis mensual, el que alimenta el plan del mes siguiente).
  Sin argumento: el **mes anterior completo**.
- `baseline`: últimos 90 días. Es el diagnóstico inicial que dispara `/nuevo-cliente` (o el que se
  usa si nunca se analizó la cuenta).

Lo ejecuta el subagente **`community-manager`** (ver `.claude/agents/community-manager.md`).

## Procedimiento

1. **Verificar la conexión**: `ver_cuenta`. Si el cliente no tiene `ig_user_id` en
   `.claude/instagram-cuentas.json`, no hay token, o Meta devuelve error de permisos
   (falta `instagram_manage_insights`), **detenerse y decirlo**: qué falta y cómo arreglarlo
   (`docs/conectar-instagram.md`). No inventar datos ni analizar "a ojo".

2. **Recopilar** con `recopilar_estadisticas` (`mes` o `baseline:true`). Genera
   `clientes/<cliente>/analisis/<periodo>.datos.json` con perfil, publicaciones con insights,
   métricas de cuenta, audiencia y agregados por formato / día / franja / hashtags. Leer el
   archivo completo con `Read` si hace falta el detalle por pieza.
   - Si el mes tiene 0 publicaciones o la cuenta es nueva: decirlo; el análisis se limita a
     audiencia, perfil y competidores, y las decisiones se marcan como **hipótesis a validar**.

3. **Completar con la API cuando aporte** (todo solo lectura):
   - `benchmark_competidor` por cada competidor listado en el `perfil.md` (máx. 3).
   - `insights_publicacion` para profundizar en las 2 mejores y las 2 peores piezas.

4. **Leer el contexto**: `perfil.md` (pilares, restricciones, objetivo), `aprendizajes.md`, el
   `calendario-editorial.md` del período y el análisis del mes anterior (si existe) para medir
   **evolución**, no solo foto.

5. **Escribir el análisis** en `clientes/<cliente>/analisis/<periodo>.md` con esta estructura:

   ```
   # Análisis de Instagram — <cliente> — <periodo>
   ## Resumen (3-4 líneas: qué pasó y qué es lo más importante)
   ## Números clave        (seguidores y variación, alcance, vistas, interacciones, tasa de interacción)
   ## Qué funcionó         (formatos, temas/pilares, días y horarios, hashtags) — cada punto con su dato y n
   ## Qué no funcionó      (igual, con dato)
   ## Audiencia            (edad/género/ciudad, horas con más seguidores conectados)
   ## Contra la competencia (si hubo benchmark)
   ## Cumplimiento del plan (publicado vs. calendario-editorial)
   ## Huecos de datos      (métricas que Meta no entregó, muestras chicas)
   ## Decisiones para el plan de <mes siguiente>
   D1. … D2. … (numeradas)
   ```

   **Decisiones**: entre 4 y 8, concretas y accionables, cada una con la evidencia que la
   respalda. Cubrir siempre: **mix de formatos** (cuántos de cada uno), **cantidad de posteos por
   semana**, **días y franjas horarias**, **pilares/temas a reforzar o frenar**, **hashtags y
   largo de caption**, y **qué probar** (experimento con criterio de éxito). Ejemplo:
   *"D2. 4 de los 8 posteos del mes serán carruseles: tasa de interacción 6,1 % vs 2,3 % de la
   imagen simple (n=5 vs n=4)."*

6. **Parada obligatoria**: presentar el análisis y las decisiones al usuario
   (`AskUserQuestion`: validar / ajustar decisiones / descartar). El criterio humano puede
   matizar lo que la métrica no ve (una promoción, un evento, una campaña paga).

7. **Solo tras la validación**: dejar el `.md` como definitivo (marcar `Estado: validado`),
   registrar la línea en `registro-actividad.log` y sugerir el siguiente paso:
   `/campania-mensual <cliente> <mes> <objetivo>`.

## Método

Seguir la sección *Métricas y mejora continua* de `.claude/referencias/criterios-editoriales.md`:
comparar contra el historial **de la propia cuenta**, separar orgánico de pauta, distinguir
correlación de causalidad y cerrar con **un experimento medible** y una decisión concreta.

## Reglas

- **Solo lectura sobre Instagram**: este skill no publica, no responde comentarios ni modifica la
  cuenta. La única escritura es la carpeta `clientes/<cliente>/analisis/`.
- **Nunca inventar métricas.** Si la API no entregó un dato, va en "Huecos de datos". Un grupo
  marcado `muestra_chica` (n < 3) no justifica una decisión firme: puede ser una hipótesis a probar.
- Correlación no es causa: si un formato rindió más pero se publicó en el mejor horario o con una
  promo, decirlo.
- Nunca generalizar entre clientes: cada decisión sale de los datos *de esa cuenta*.
- Los números salen de la herramienta (`resumen` del snapshot); no recalcular ni redondear a ojo.
