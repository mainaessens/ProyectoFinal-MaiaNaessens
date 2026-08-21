---
name: nuevo-cliente
description: Da de alta un cliente nuevo en la agencia. Crea su carpeta en clientes/<nombre>/ con la estructura completa (perfil.md, assets/, historial/, registro de actividad). Si se da una URL de Google Drive, lee el brief y el manual de marca de esa carpeta y genera un perfil.md enriquecido automáticamente (Fase 2); si no, arma el perfil a partir de lo que indique el usuario en el chat (comportamiento de Fase 0).
tools: Read, Write, Glob, mcp__gworkspace__*
---

# /nuevo-cliente

Da de alta un cliente nuevo de la agencia.

## Uso

```
/nuevo-cliente <nombre-cliente> [url-drive-opcional]
```

- `<nombre-cliente>`: nombre corto, en minúsculas y sin espacios (usar guiones si hace falta).
  Ejemplo: `cafe-lunar`, `cedite`.
- `[url-drive-opcional]`: URL de la carpeta de Google Drive del cliente. Si se da, dispara el
  flujo de lectura automática (ver más abajo). Si no, el perfil se arma solo con lo que el
  usuario indique en el chat.

## Procedimiento

1. **Verificar que no exista ya** `clientes/<nombre-cliente>/`. Si existe, avisar y detenerse —
   no sobrescribir sin confirmación explícita.
2. **Crear la estructura** copiando `clientes/plantilla/`:
   ```
   clientes/<nombre-cliente>/
   ├── perfil.md
   ├── calendario-editorial.md
   ├── aprendizajes.md
   ├── historial/
   ├── assets/
   │   ├── fotos/
   │   └── videos/
   └── registro-actividad.log
   ```
3. **Si se dio `url-drive`**, seguir el flujo de lectura automática (sección siguiente).
   **Si no**, preguntar al usuario (no asumir) los datos mínimos para un perfil útil: sector,
   público objetivo, tono, 2-3 pilares de contenido, y qué NO publicar. Usar AskUserQuestion o
   preguntas directas en el chat.
4. **Presentar el perfil resultante completo** antes de darlo por cerrado — el usuario puede
   corregir cualquier campo. Esto aplica siempre, venga el perfil de Drive o del chat.
5. **Crear `registro-actividad.log`** vacío con una primera línea de alta:
   `[<fecha>] Cliente <nombre-cliente> dado de alta.`
6. Confirmar al usuario la ruta creada y sugerir el siguiente paso (`/plan-del-dia`, o
   `descargar-assets.ps1` para traer fotos/videos si aún no se hizo).

## Flujo de lectura automática desde Drive (Fase 2)

1. Extraer el ID de carpeta de la URL de Drive dada.
2. Con las herramientas de `gworkspace`, listar el contenido de esa carpeta y localizar:
   - El **brief** (documento de texto/Google Doc — buscar por nombre "brief" o el primer doc de
     texto de la carpeta).
   - El **manual de marca** (PDF — buscar por nombre "manual" o "marca").
   - Las subcarpetas `fotos/` y `videos/` (solo se anota que existen; la descarga real de los
     archivos la hace `scripts/descargar-assets.ps1`, no este skill).
3. Leer el contenido del brief y del manual de marca.
4. **Extraer y proponer** (no inventar más allá de lo que el material realmente dice):
   - Tono de comunicación (frases, adjetivos que usa la marca).
   - Paleta de colores y tipografías (si el manual las especifica).
   - Público objetivo.
   - Pilares de contenido sugeridos.
   - Restricciones — qué NO publicar (si el brief lo menciona explícitamente; si no, dejar la
     sección para completar a mano y decirlo).
5. **Marcar claramente qué se infirió del material y qué quedó pendiente** — nunca presentar una
   inferencia como un hecho confirmado por el cliente sin dejarlo explícito.
6. Generar `perfil.md` con esos datos y presentarlo para revisión (paso 4 del procedimiento
   general) antes de guardarlo como definitivo.
7. Si el brief o el manual no se encuentran en la carpeta, avisar qué falta y continuar con lo
   que sí se pudo leer — no bloquear el alta del cliente por eso.

## Reglas

- Nunca crear tareas en Jira ni eventos en Calendar desde este skill (eso ocurre en los skills
  de Fase 3 en adelante, y siempre tras aprobación).
- Nunca sobrescribir un cliente existente sin confirmación explícita del usuario.
- Nunca descargar ni escribir archivos binarios (fotos/videos) desde este skill — esa
  responsabilidad es de `scripts/descargar-assets.ps1`, para mantener el skill rápido y enfocado
  en el perfil.
- El perfil generado debe quedar coherente con el formato de `clientes/plantilla/perfil.md`.
- Si se lee del manual de marca algo que contradice lo que el usuario diga en el chat, priorizar
  lo que diga el usuario y señalar la contradicción explícitamente al presentar el perfil.
