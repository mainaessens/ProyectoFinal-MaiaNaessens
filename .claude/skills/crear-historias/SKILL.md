---
name: crear-historias
description: Arma una secuencia de 1 a 3 historias de Instagram (función de cada una, texto exacto, recurso real o diseño en Canva) y, con aprobación humana por separado, la publica con la API. Detecta qué historias necesitan stickers, encuestas o links —que la API no soporta— y las deja como plan manual. Nunca publica sin un OK explícito para esa secuencia.
tools: Read, Write, Bash, AskUserQuestion, mcp__canva__*, mcp__gworkspace__*, mcp__instagram__ver_cuenta, mcp__instagram__subir_archivo_publico, mcp__instagram__publicar_historia
---

# /crear-historias

Convierte una fila de historias del calendario (o un tema libre) en una secuencia lista para
publicar. Las historias son **conversación diaria, no cartelería**.

## Uso

```
/crear-historias <cliente> <#|slug|"tema libre">
```

## Qué puede y qué no puede la API

| La API publica | La API **no** hace |
|---|---|
| Imagen o video vertical, en orden, una historia tras otra | Stickers de encuesta, quiz, preguntas, deslizador, cuenta regresiva |
| | Links, menciones y hashtags clicables, música |
| | Programar a futuro (publica al instante) |

Las historias duran 24 h. Todo el texto tiene que ir **dentro de la imagen o el video**.

## Procedimiento

1. **Resolver la pieza**: leer `calendario-editorial.md` (fila con formato *Historias*) o tomar el
   tema libre. Leer `perfil.md` (tono, restricciones, *reglas de estilo y validación*, plantilla
   de historia de Canva) y `.claude/referencias/criterios-editoriales.md` +
   `.claude/referencias/guia-formatos.md` (sección *Historias*).

2. **Diseñar la secuencia** (1–3 historias, o las que permita el contrato del cliente). Por cada
   una definir:
   - **Función**: abrir interés / dar contexto o prueba / invitar a responder o actuar.
   - **Texto exacto en pantalla** (corto, legible en móvil, dentro de las zonas seguras).
   - **Recurso**: foto o video **real** del cliente (`assets/`), o plantilla Canva sin foto.
     Imagen IA solo bajo las tres condiciones de `CLAUDE.md`, declarada.
   - **CTA único** para toda la secuencia, o ninguno si es informativa.
   - **¿Necesita sticker, encuesta o link?** Si sí, esa historia se marca `manual`.
   - Si falta un dato (horario, promo, disponibilidad del día), marcarlo **POR CONFIRMAR**; no
     inventarlo. No inventar interacción: una encuesta ofrece opciones naturales.

3. **Autoevaluar** con `.claude/referencias/autoevaluacion.md` (menos de 16/20 → reescribir).
   Correr `checklist-marca.ps1` sobre los textos.

4. **Separar publicación automática y manual**:
   - Las historias **sin** stickers/links van en un plan automático.
   - Las que necesitan stickers, encuestas o links van en **otro plan** con
     `"publicacion": "manual"`: se entregan con la pauta exacta (sticker, opciones, texto) para
     que el humano las publique desde la app. El conector se niega a publicarlas.

5. **Diseñar** (subagente `disenador`): exportar cada historia en vertical 9:16 (1080×1920) a
   `assets/exports/<fecha>-<slug>-<n>.png`; si el recurso es un video real, usar el archivo de
   `assets/videos/` (se puede pasar antes por `/editar-video`). Revisar cada pieza contra el perfil
   (paleta, tipografía, texto sin errores, zonas seguras) antes de mostrarla.

6. **Presentar la secuencia** (función de cada historia, textos, recursos, puntaje, datos POR
   CONFIRMAR, cuáles son manuales, horario) y pedir decisión con `AskUserQuestion`: aprobar /
   pedir cambios / rechazar. Un cambio genera una versión nueva.

7. **Si aprueba**, generar `clientes/<cliente>/historial/<fecha>-<slug>.plan.json`:
   ```json
   {
     "cliente": "<cliente>",
     "fecha_creacion": "<hoy>",
     "aprobado": true,
     "formato": "historia",
     "red": ["instagram"],
     "historias": [
       { "orden": 1, "funcion": "abrir interés", "tipo": "imagen", "archivo": "assets/exports/<fecha>-<slug>-1.png", "texto_en_pantalla": "..." },
       { "orden": 2, "funcion": "dar prueba", "tipo": "video", "archivo": "assets/videos/<archivo>.mp4", "texto_en_pantalla": "..." }
     ],
     "cta": "...", "objetivo": "...", "kpi": "respuestas / avance / toques",
     "autoevaluacion": { "puntaje": 18, "abiertos": [] },
     "fecha_programada": "<horario aprobado>",
     "estado": "listo_para_publicar"
   }
   ```
   El plan manual lleva además `"publicacion": "manual"` y, por historia, `"sticker": "encuesta: A / B"`.
   Marcar la pieza en `calendario-editorial.md`.

8. **Publicar con la API (opcional, con OK separado)**: solo si el cliente tiene `ig_user_id`
   (`docs/conectar-instagram.md`). Pedir un OK explícito: *"publicar estas N historias en
   Instagram ahora"*. Luego, siempre pasando `cliente` y `plan`:
   1. `subir_archivo_publico` → URLs https en el orden de `historias`.
   2. `publicar_historia` con `items: [{tipo, url}, ...]` **sin** `confirmar` → simulacro; mostrarlo.
   3. Con el OK, repetir con `confirmar:true`.
   La API publica al instante: no llamar antes del horario aprobado salvo que el usuario pida
   publicar ya (`ignorar_fecha_programada:true`). Si la secuencia queda **parcial** (falló una a
   mitad), el conector lo registra y bloquea el reintento: informar cuáles salieron y dejar el
   resto para publicar a mano.

9. **Cierre**: qué quedó publicado, qué quedó manual (con su pauta) y qué quedó pendiente.

## Reglas

- Proponer → revisar → ejecutar: sin OK explícito sobre textos, recursos y horario no hay plan
  aprobado, y publicar requiere su propio OK.
- Nunca intentar simular stickers o links con la API: lo que no soporta va como plan manual.
- Un `.plan.json` aprobado es inmutable en contenido; un cambio genera un archivo nuevo.
- Nunca publicar historias con imagen de personas reales o menores sin el consentimiento que
  indique el perfil.
