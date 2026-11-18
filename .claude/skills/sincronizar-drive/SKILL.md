---
name: sincronizar-drive
description: Sube a la carpeta "06 Agente" del Drive del cliente toda la información que genera la agencia (perfil, calendario, aprendizajes, análisis, historial, tendencias), para que el cliente y el equipo la vean junto a su material. Se ejecuta solo al terminar el alta y cada vez que cambian esos datos. Sube solo lo nuevo o modificado y nunca sube material audiovisual, tokens ni el registro de auditoría.
tools: Read, Write, Glob, Bash, mcp__gworkspace__*
---

# /sincronizar-drive

Copia los datos de `clientes/<cliente>/` a la carpeta **`06 Agente`** del Drive del cliente (la
misma carpeta raíz de donde se descargan fotos y videos). Es una copia de lectura para humanos:
la fuente de verdad sigue siendo `clientes/<cliente>/`; lo que se edite en Drive no vuelve.

## Uso

```
/sincronizar-drive <cliente>
```

Se invoca automáticamente al final de `/nuevo-cliente`, `/campania-mensual`, `/analisis-cuenta`
y `/cierre-mensual`, y a mano cuando haga falta.

## Qué se sube y qué no

| Se sube (ruta relativa a `clientes/<cliente>/`) | No se sube |
|---|---|
| `perfil.md`, `calendario-editorial.md`, `aprendizajes.md` | `assets/` (fotos, videos, exports: el material vive en Drive o es pesado) |
| `analisis/`, `historial/` (incluye `*.plan.json`), `tendencias-*.md` | `registro-actividad.log` (auditoría interna) |
| cualquier otro `.md` o `.json` de datos del cliente | `.drive-agente.json`, archivos temporales y todo lo oculto |
| | cualquier archivo que contenga un token o secreto (ver abajo) |

**Antes de subir, escanear** cada archivo en busca de `ya29.`, `1//0`, `GOCSPX-`, `AIza`, `EAA` +
cadena larga, `Bearer ` o `access_token`/`client_secret`/`refresh_token` con valor. Si aparece,
**no subirlo**, y avisar el nombre del archivo.

## Procedimiento

1. **Ubicar la carpeta raíz del cliente en Drive**: el ID de la URL `drive.google.com/drive/folders/<id>`
   en `perfil.md`. Si no hay, avisar y detenerse (sin Drive no hay nada que sincronizar).

2. **Leer el manifiesto** `clientes/<cliente>/.drive-agente.json` (si no existe, es la primera
   vez):
   ```json
   { "carpetaId": "<id de 06 Agente>", "carpetas": { "historial": "<id>" },
     "archivos": { "perfil.md": { "id": "<id>", "sha256": "<hash>" } } }
   ```

3. **Asegurar la carpeta `06 Agente`**: si el manifiesto no tiene `carpetaId`, buscar con el conector
   (`search_files`: `parentId = '<raíz>' and title = '06 Agente'`) antes de crearla; si no existe,
   crearla con `create_file` (`mimeType` `application/vnd.google-apps.folder`, `parentId` la raíz).
   Hacer lo mismo para cada subcarpeta (`analisis`, `historial`, …) bajo `06 Agente`, y guardar los
   IDs en el manifiesto.

4. **Calcular el SHA-256** de cada archivo a subir (PowerShell `Get-FileHash -Algorithm SHA256`) y
   compararlo con el manifiesto:
   - **Igual** → no hacer nada.
   - **Distinto o ausente** → subir.

5. **Subir** con `create_file`: `title` = nombre del archivo, `parentId` = carpeta que corresponde,
   `textContent` = contenido, `contentMimeType` = `text/markdown` (`.md`) o `application/json`
   (`.json`) y `disableConversionToGoogleType: true` para que quede el archivo tal cual.
   - El conector no tiene operación para reemplazar el contenido de un archivo. Si el archivo ya
     estaba en el manifiesto, **primero se sube la versión nueva** y, solo cuando esa subida
     terminó bien, se envía a la **papelera** (`trash_file`, recuperable) el archivo anterior
     **cuyo ID está en el manifiesto**. Nunca se toca nada que no figure en el manifiesto.
   - Guardar el nuevo `id` y `sha256` en el manifiesto.

6. **Escribir el manifiesto** actualizado y registrar la sincronización en
   `clientes/<cliente>/registro-actividad.log`:
   `[<fecha>] Drive: sincronizado 06 Agente (N nuevos, M actualizados, K sin cambios, X omitidos).`

7. **Informar** cuántos archivos se subieron, cuáles se omitieron y por qué (secretos detectados,
   archivos excluidos), y el enlace a la carpeta `06 Agente`.

## Reglas

- Solo escribe dentro de `06 Agente`. Nunca modifica, mueve ni borra el material del cliente ni sus
  documentos (brief, manual, fotos, videos).
- No pide confirmación por archivo: el alta y los cambios de datos ya fueron aprobados por el humano
  en el skill que lo invoca. Esta copia no publica nada ni envía comunicaciones al cliente.
- Sin conector de Drive disponible o sin permiso de escritura: decirlo, dejar el estado como
  **pendiente** en `perfil.md` (sección "Estado del alta") y seguir; no bloquea el resto del flujo.
- Nunca subir tokens, claves ni datos de acceso, aunque estén dentro de un archivo permitido.
