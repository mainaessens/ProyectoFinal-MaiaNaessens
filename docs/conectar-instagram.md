# Conectar Instagram (publicación automática)

Conector propio: `mcp/instagram-publisher/` (Node, sin dependencias) sobre la Instagram Graph API
oficial de Meta. Publica solo el caption de un `.plan.json` **aprobado**, una vez por plan.

## Herramientas

| Herramienta | Qué hace | Efecto |
|---|---|---|
| `ver_cuenta` | usuario conectado y cuota de publicación | solo lectura |
| `subir_archivo_publico` | sube la(s) imagen(es) exportada(s) del plan a Vercel Blob y devuelve URL(s) https | deja el archivo público (URL imposible de adivinar) |
| `publicar_imagen` | publica una imagen | publica (con `confirmar:true`) |
| `publicar_carrusel` | publica 2–10 imágenes en orden (`image_urls`) | publica (con `confirmar:true`) |
| `publicar_reel` | publica un Reel (`video_url`, `cover_url` opcional) | publica (con `confirmar:true`) |

Todas reciben `cliente` y `plan`. Sin `confirmar:true`, las de publicación solo simulan.

## Qué necesitás

1. **Cuenta de Instagram profesional** (Business o Creator).
2. **App en developers.facebook.com** y un **token** de Meta con `instagram_basic` e
   `instagram_content_publish` (más `pages_show_list` y `pages_read_engagement` en el camino de
   Facebook Login). No marcar permisos de anuncios ni de mensajes: el principio es el mínimo permiso.
3. **El `ig_user_id`** de la cuenta, en `.claude/instagram-cuentas.json` (no es un secreto).
4. **Un store público de Vercel Blob** para alojar las imágenes (Meta las descarga por URL).

### Dos tipos de token (cambia el host de la API)

| Token | Empieza con | Host | `META_GRAPH_BASE` |
|---|---|---|---|
| Facebook Login / usuario del sistema | `EAA…` | `graph.facebook.com` | **sin definir** |
| Instagram Login | `IGAA…` | `graph.instagram.com` | `https://graph.instagram.com/v23.0` |

Un `ig_user_id` que empieza con `17841…` corresponde a una cuenta de Instagram vinculada por el
camino de Facebook. La versión de la API se cambia con `META_GRAPH_VERSION`.

### Token de usuario del sistema (Meta Business) — pasos que funcionaron
1. business.facebook.com/settings → **Usuarios del sistema** → crear uno (rol *Employee*).
2. **Agregar activos**: la cuenta de Instagram (permiso de administrar contenido) y su página de Facebook.
3. **Generar token** para la app del portfolio, con solo los permisos de arriba, y duración de 60 días.
4. Si el usuario del sistema no tiene la cuenta asignada, la API responde que el ID "no existe o
   falta permiso" (`/me/assigned_instagram_accounts` devuelve vacío).

### Store de Vercel Blob
vercel.com → Storage → Create → Blob → acceso **Public** (nombre sugerido `agencia-publicaciones`).
Un store *privado* hace fallar la subida con: `Cannot use public access on a private store`; un store
no puede cambiar de privado a público, hay que crear otro.

## Variables de entorno (las cargás vos; nunca en archivos ni en el chat)

```powershell
[Environment]::SetEnvironmentVariable("INSTAGRAM_ACCESS_TOKEN", "<token>", "User")
[Environment]::SetEnvironmentVariable("BLOB_READ_WRITE_TOKEN", "<token del store público>", "User")
```
Opcional por cliente: `INSTAGRAM_TOKEN_<CLIENTE>` (ej. `INSTAGRAM_TOKEN_MI_CLIENTE` para el cliente `mi-cliente`).
Reiniciar Claude Code después de cargarlas. Alternativa a Blob: `SUPABASE_URL` y `SUPABASE_KEY`.

## Probar sin riesgo
1. `ver_cuenta` → debe mostrar el usuario y la cuota (solo lectura).
2. `publicar_*` **sin** `confirmar` → simulacro con el caption, las URLs y la fecha.
3. Con OK explícito, `confirmar:true` en una cuenta de prueba.
4. Comprobar que un plan no aprobado o ya publicado se bloquea.

La API de Instagram **no permite borrar** publicaciones: se borran desde la app.

## Barreras
- Hook `validar-publicacion.ps1` (exige plan aprobado del cliente) **y** el propio conector (plan
  aprobado, cliente correcto, no publicado antes, https, fecha programada, cantidad de placas).
- El caption nunca viene del chat: sale del plan aprobado.
- El token no aparece en errores ni en logs.

## Estado de verificación
- **Verificado contra servicios reales (2026-11-04):**
  - `ver_cuenta` con una cuenta profesional real (cuota 0/100 por 24 h).
  - `subir_archivo_publico` contra un store público de Vercel Blob (2 placas, URLs con HTTP 200 y `image/png`).
  - `publicar_carrusel` de 2 placas: publicado en Instagram, con registro `<plan>.publicado.json`,
    línea de auditoría y bloqueo de una segunda publicación del mismo plan.
- **Probado solo con servicios simulados:** `publicar_imagen` y `publicar_reel`.

## Tests
`node --test mcp/instagram-publisher` (24 tests con Graph API y Vercel Blob simulados).
