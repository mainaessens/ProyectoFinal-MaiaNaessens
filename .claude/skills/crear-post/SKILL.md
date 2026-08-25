---
name: crear-post
description: Pipeline completo para armar un post — hook + caption adaptado por red + pieza gráfica real (Canva, conectado) + propuesta de programación — y generar un PLAN de publicación tras aprobación humana. Nunca publica de verdad ni llama al conector de redes sociales; genera un archivo .plan.json en estado "pendiente_aprobacion" / "aprobado" que quedará listo para publicarse cuando se registre el conector Late/Postiz (PFMGN-16, pendiente de coordinación externa). Si Canva no estuviera disponible en algún momento, el paso de diseño cae a modo plan (diseno_pendiente: true) en vez de bloquear el resto del pipeline.
tools: Read, Write, AskUserQuestion
---

# /crear-post

Arma un post de punta a punta y lo deja en un PLAN aprobado, listo para publicar en cuanto
exista el conector real (Late/Postiz).

## Uso

```
/crear-post <cliente> <tema-o-tarea>
```

- `<cliente>`: nombre de la carpeta en `clientes/<cliente>/`.
- `<tema-o-tarea>`: de qué trata el post (o referencia a una tarea de Jira si ya existe).

## Procedimiento

1. **Leer el perfil del cliente** (`perfil.md`): tono, pilares de contenido, restricciones,
   redes activas.

2. **Generar el hook y el caption base** (rol de copywriter): la primera frase/idea que retiene
   la atención, fundamentada en el tema pedido y coherente con los pilares del cliente. Correr
   `checklist-marca.ps1` sobre el caption propuesto para detectar posibles violaciones de las
   restricciones del perfil, y mostrar las alertas si las hay (no bloquea, es información para
   la revisión humana).

3. **Adaptar el caption por red** (subagente `community-manager`): una versión por cada red
   activa del cliente (Instagram / Facebook, según `perfil.md`).

4. **Producir la pieza gráfica** (subagente `disenador`, Fase 5): siguiendo la prioridad de
   material (foto real del cliente → plantilla Canva sin foto → imagen IA, Fase 6). Con el
   conector de Canva conectado, genera la pieza real usando las plantillas maestras del cliente
   (nunca los brand kits de otros clientes de la cuenta). **Si en algún momento el conector no
   estuviera disponible**, este paso cae a modo plan: en vez de generar la pieza real, se anota
   en el `.plan.json` qué plantilla y qué material se usarían (`diseno_pendiente: true`), sin
   bloquear el resto del flujo.

5. **Sugerir horario** usando la lógica de `agents/horario-optimo.md` (Calendar + histórico si
   existe), si el cliente tiene `google_calendar_id` configurado en su perfil.

6. **Presentar la propuesta completa** al usuario: hook, caption por red, horario sugerido, y
   pieza gráfica (o la nota de diseño pendiente si Canva todavía no está conectado). Usar
   `AskUserQuestion` para que el usuario apruebe, pida cambios, o rechace.

7. **Si pide cambios**: volver al paso 2, 3 o 4 según corresponda, generar una nueva versión, y
   volver a presentar. No se sobrescribe silenciosamente la versión anterior.

8. **Si aprueba**: generar `clientes/<cliente>/historial/<fecha>-<slug>.plan.json` con:
   ```json
   {
     "cliente": "<cliente>",
     "fecha_creacion": "<hoy>",
     "aprobado": true,
     "red": "<red o lista de redes>",
     "hook_texto": "...",
     "caption": { "instagram": "...", "facebook": "..." },
     "diseno": {
       "fuente": "foto_cliente | plantilla_sin_foto | glif",
       "plantilla_canva": "<id o nombre, si aplica>",
       "diseno_pendiente": true
     },
     "fecha_programada": "<horario aprobado>",
     "estado": "listo_para_publicar_cuando_exista_conector"
   }
   ```
   **No se llama a ningún conector MCP de publicación ni de Canva** — ninguno de los dos está
   registrado todavía en este proyecto (PFMGN-16 y PFMGN-42, pendientes de coordinación
   externa). Este PLAN queda guardado y es justamente lo que el hook `validar-publicacion.ps1`
   exige que exista (con `aprobado: true`) antes de permitir cualquier llamada real de
   publicación en el futuro.

9. Confirmar al usuario que el PLAN quedó guardado, y aclarar explícitamente qué quedó
   pendiente de ejecutar de verdad (publicación, y diseño si Canva no estaba conectado).

## Reglas

- Ciclo proponer → revisar → ejecutar, sin excepciones: nunca se genera el `.plan.json` con
  `aprobado: true` sin un OK explícito y completo del usuario (texto y horario incluidos).
- Nunca se intenta llamar a un conector de publicación que no está registrado — este skill se
  detiene siempre en "generar el plan".
- Cada `.plan.json` es inmutable una vez aprobado: un cambio posterior genera un nuevo archivo,
  no edita el aprobado (para mantener trazabilidad).
