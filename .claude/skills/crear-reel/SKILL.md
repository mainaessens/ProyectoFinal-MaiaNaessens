---
name: crear-reel
description: Arma un reel de punta a punta — guion con gancho en el primer segundo, selección del video real del cliente (assets/videos), portada en Canva, caption por red y horario — y genera un PLAN de publicación tras aprobación humana. Nunca edita ni sube video por sí mismo ni publica; deja el plan listo y, si no hay video adecuado, lo declara en vez de inventarlo.
tools: Read, Write, Bash, AskUserQuestion, mcp__canva__*, mcp__gworkspace__*
---

# /crear-reel

## Uso

```
/crear-reel <cliente> <#|slug|"tema libre">
```

## Procedimiento

1. **Resolver el posteo** desde `calendario-editorial.md` (formato Reel) o tema libre; leer
   `perfil.md` (tono, restricciones, plantillas Canva, redes).
2. **Elegir material**: revisar `clientes/<cliente>/assets/videos/`. Prioridad: video real del
   cliente → ninguno adecuado = decirlo y proponer qué filmar (lista de tomas). Nunca inventar
   ni generar video con IA (queda en "Futuras mejoras").
   **Si el video en bruto necesita edición** (cortar silencios y repeticiones, subtítulos, títulos con
   la marca del cliente), ofrecer `/editar-video <cliente> <bruto>`: el archivo terminado queda en
   `assets/terminados/` y es el `video` del plan.
3. **Guion** (copywriter), siguiendo `.claude/referencias/guia-formatos.md` (sección Reels) y
   `criterios-editoriales.md`:
   - Objetivo, público, insight, hipótesis y KPI (retención, compartidos, alcance a no
     seguidores, según el objetivo).
   - **2–3 opciones de hook** sustancialmente distintas; elegir una y justificarla con una
     tendencia, un pilar del perfil o un dato del análisis. Pasar el *test del hook* (se entiende
     sin sonido, es distinto de los 3 reels anteriores, no promete algo que el video incumple).
   - **Ficha completa**: duración estimada (15–40 s salvo justificación), guion escena por escena
     (tiempo, quién habla, texto exacto o pauta, plano/acción/B-roll, texto en pantalla), audio,
     recursos, CTA único, indicaciones de edición y **datos a confirmar**.
   - **Autoevaluar** con `.claude/referencias/autoevaluacion.md` (menos de 16/20 → reescribir).
4. **Caption por red** (`community-manager`): IG con gancho en la primera línea y hasta 8
   hashtags; FB más largo. Correr `checklist-marca.ps1` y mostrar las alertas.
5. **Portada** (`disenador`): copiar la plantilla maestra de historia/reel del cliente y poner el
   hook, con los colores exactos del manual. Revisar el resultado antes de mostrarlo.
6. **Horario**: lógica de `agents/horario-optimo.md` o la fecha del calendario.
7. **Presentar** la ficha, guion, tomas, portada, captions, horario, puntaje de autoevaluación y
   datos POR CONFIRMAR; pedir decisión con `AskUserQuestion`
   (aprobar / cambios / rechazar), una pieza por vez en lote.
8. **Si aprueba**: exportar la portada a `assets/exports/`, copiar/referenciar el video elegido
   y generar `historial/<fecha>-<slug>.plan.json` con `formato: "reel"`, `diseno` (portada),
   `video` (ruta del archivo o `null` si falta) y `estado`
   `listo_para_publicar_cuando_exista_conector`. Si falta el video, el plan queda con
   `aprobado: true` solo si el usuario acepta explícitamente que el video se sumará después.

## Reglas

- Proponer → revisar → ejecutar; sin OK explícito no hay `.plan.json` aprobado.
- No publica ni programa: eso depende del conector (PFMGN-16).
- Un plan aprobado es inmutable en contenido; un cambio genera un archivo nuevo.
