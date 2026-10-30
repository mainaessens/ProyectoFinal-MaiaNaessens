# Guía de testeo manual — cliente nuevo

Orden recomendado. Cada paso dice qué ejecutar y qué tiene que pasar. Anotá ✅/❌ y, si algo
falla, pegame el mensaje exacto.

## 0. Antes de empezar

1. Abrí Claude Code con la carpeta `agencia/` como proyecto (así `$CLAUDE_PROJECT_DIR` apunta bien).
2. Conectá Canva, Google Drive/Calendar y Atlassian (ver "Conectores" abajo).
3. Corré la suite automática desde `agencia/`:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tests\Run-Tests.ps1
   ```
   Esperado: `Total: 109  Pasaron: 109  Fallaron: 0`.
4. Preparí una carpeta de Drive del cliente nuevo con: un doc "Brief de marca - X", un doc
   "Manual de Marca - X", y subcarpetas `fotos/` y `videos/` (pueden estar vacías).

## 1. `/nuevo-cliente <nombre> <url-drive>`

- Propone un orden del Drive (tabla archivo → destino) y espera tu OK antes de mover algo;
  nunca borra.
- Descarga fotos y videos a `assets/` y ofrece generar las plantillas de Canva faltantes con
  Canva o con Claude Design (se omite si ya están en el Drive).
- Crea `clientes/<nombre>/` con `perfil.md`, `aprendizajes.md`, `calendario-editorial.md`,
  `registro-actividad.log`, `assets/` (fotos, videos, exports), `historial/`.
- Cada dato del perfil cita su fuente (brief o manual) y lo que falta aparece como "pendiente".
- Te pide aprobación del perfil antes de darlo por final.
- Probá también sin URL de Drive (alta solo con lo que digas en el chat).

## 2. Plantillas de Canva (cliente nuevo)

Pedime: "diseñá las 3 plantillas maestras de Canva para `<cliente>`" (post, carrusel, portada
de historia). Esperado: 3 designs creados **sin brand kit**, paleta/tipografía tomadas del
perfil, y IDs/links guardados en la sección "Plantillas maestras de Canva" de `perfil.md`.
Abrí los links y revisá colores, tipografía y que no haya texto inventado.

## 3. `/crear-post <cliente> <#|slug|todos>` (después de aprobar `/campania-mensual`)

- `/campania-mensual` ofrece al terminar: un posteo por número/nombre, todos juntos, o más tarde.
- Con `todos`, presenta un diseño por vez. Al aprobar exporta el diseño de Canva a
  `assets/exports/`. Publicar requiere conector y un OK aparte por pieza.
- Propone hook + caption por red + pieza (Canva) + horario.
- Si el caption incluye algo prohibido por el perfil (ej. un precio), `checklist-marca` avisa.
- Pide aprobación con opciones aprobar / cambiar / rechazar.
- Al aprobar genera `historial/<fecha>-<slug>.plan.json` con `"aprobado": true`.
- NO publica nada. Probá "pedir cambios": debe crear una versión nueva, no pisar la anterior.

## 4. `/plan-del-dia <cliente>`

- Lee Calendar y Jira (necesita `jira_project_key` y `google_calendar_id` en el perfil).
- Solo lectura. Lista de hoy + próxima semana. Cambia un estado en Jira solo si lo pedís.

## 5. `/campania-mensual <cliente> <mes> <objetivo>`

- Tabla (fecha, red, formato, tema, hook, CTA) usando pilares del perfil + tendencias.
- No crea nada en Jira/Calendar hasta que apruebes explícitamente.

## 6. `/reporte-semanal <cliente>` y `/cierre-mensual <cliente>`

- Leen el log de actividad y el Calendar, y escriben en `historial/AAAA-MM.md` y
  `aprendizajes.md`. Con un cliente nuevo habrá pocos datos: tiene que decirlo, no inventar.

## 7. Seguridad (human-in-the-loop)

- Pedile al agente que "publique ya" sin aprobación: debe negarse y mostrar la propuesta.
- Mientras no haya conector de publicación (Late/Postiz), el sistema nunca publica.
- Revisá `clientes/<cliente>/registro-actividad.log`: debe registrar cada acción de Jira.
- Verificá que ningún design se haya creado con un brand kit de otro cliente.

## Conectores

**Canva** (cuenta real de la agencia: el sistema no debe usar brand kits ajenos)

- App de escritorio / claude.ai: *Settings → Connectors → Canva → Connect*, iniciá sesión con
  Canva y aceptá permisos. Abrí una **sesión nueva** para que las herramientas aparezcan.
- Claude Code por terminal:
  ```bash
  claude mcp add --transport http canva https://mcp.canva.com/mcp
  ```
  y luego `/mcp` → canva → Authenticate.
- Comprobación: pedime "listá los brand kits de Canva"; si responde sin error, está conectado.

**Google Drive / Calendar** y **Atlassian (Jira)**: mismo menú *Settings → Connectors*.

## Pendientes conocidos (no son fallos)

- Publicación real (Late/Postiz), Glif (imágenes IA) y Meta Ads: sin conector todavía.
- El hook de publicación exige `cliente` en `tool_input`; hay que adaptarlo al conectar Late/Postiz.
