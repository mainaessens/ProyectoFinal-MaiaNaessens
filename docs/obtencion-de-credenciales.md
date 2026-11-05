# Cómo se consiguieron las APIs y credenciales (paso a paso)

Registro de lo que se hizo para conectar cada servicio, en el orden real, con los errores que
aparecieron y cómo se resolvieron. Sirve para que otra persona repita la instalación.

## 0. Reglas que valen para todo

- **Los valores van en variables de entorno del usuario** (en Windows quedan en el registro, solo para
  ese usuario). Nunca en archivos del repositorio ni pegados en un chat.
- `.claude/.env.example` **solo lista los nombres** con valor vacío; es lo que se sube a GitHub.
  Hay un test que falla si ese archivo contiene un valor.
- Si un token se expone (por ejemplo, se pega en un chat), **se revoca y se genera uno nuevo**.
- Para cargar una variable:
  ```powershell
  [Environment]::SetEnvironmentVariable("NOMBRE", "<valor>", "User")
  ```
  El comando no muestra nada: es normal. Hay que **reiniciar Claude Code** para que la tome.
- Para comprobar que está cargada **sin mostrar el valor**:
  ```powershell
  [bool][Environment]::GetEnvironmentVariable("NOMBRE","User")
  ```

## 1. Conectores de la plataforma (sin token propio)

Google Drive/Calendar, Atlassian (Jira), Canva, Vercel y Supabase se conectan desde la plataforma con
OAuth: *Settings → Connectors → (servicio) → Connect*, iniciar sesión y aceptar permisos. Después hay
que abrir una **sesión nueva** para que aparezcan sus herramientas.

Comprobación de cada uno: pedir una lectura inocua (listar brand kits de Canva, listar proyectos de
Jira, buscar archivos en Drive).

Particularidades encontradas:
- **Canva** está conectado a una cuenta con brand kits de clientes reales: los diseños se generan
  **sin brand kit**, describiendo la paleta en el brief.
- **Jira** se usa solo para el tablero de la tesis (proyecto PFMGN). Las herramientas no pueden
  crear proyectos ni editar flujos de estados (eso se hace en la web de Jira).
- **Vercel**: el conector no tuvo permiso para crear stores de Blob (error 403), así que el store se
  crea a mano en el panel (sección 4).
- **Supabase**: se descartó para alojar imágenes públicas, porque la clave da acceso a toda la base
  del proyecto.

## 2. Glif (imágenes con IA) — `GLIF_API_TOKEN`

1. Crear cuenta en glif.app.
2. Ir a glif.app/settings/api-tokens y generar un token.
3. Cargarlo como variable `GLIF_API_TOKEN` (comando de la sección 0) y reiniciar Claude Code.
4. Conectar el **servidor MCP alojado de Glif**: `https://glif.app/api/mcp`, con la API key como
   token Bearer (`Authorization: Bearer <GLIF_API_TOKEN>`). `.mcp.json` lo referencia con `${GLIF_API_TOKEN}`.
   Para Claude Code por terminal: `claude mcp add --scope user --transport http glif https://glif.app/api/mcp`
   (con OAuth o el encabezado Bearer).

**Cambio importante:** el paquete npm `@glifxyz/glif-mcp-server` (servidor local por stdio) está
**obsoleto**: npm lo marca como deprecado y su API devuelve una página HTML en lugar de JSON, por lo que
sus herramientas fallan con `Unexpected token '<'`. Hay que usar el servidor alojado.

Verificación (2026-11-04, solo con el token, desde HTTP):
1. `initialize` y `tools/list` → 12 herramientas (`compose_project`, `get_job_status`, `whoami`, `list_projects`,
   `upload_file`, `get_project`, entre otras).
2. `whoami` → cuenta válida, **50 créditos** disponibles; costo típico de una imagen: 5 a 27 créditos.
3. `compose_project` (`intelligence: lite`, una sola imagen) → `get_job_status` hasta `completed` → imagen de
   928×1152 en `assets/ia/`, **5,1 créditos** gastados.

Notas: cada llamada a `compose_project` es un trabajo **facturable**; el servidor alojado no usa sesiones;
la respuesta de `get_job_status` es un flujo de eventos (`event: message` / `data: {…}`) y la URL de la
imagen llega en `structuredContent.media[].url`. Los créditos gratuitos y límites del plan se ven en glif.app.

## 3. Instagram y Meta — `INSTAGRAM_ACCESS_TOKEN`

### 3.1 Requisitos
- Cuenta de Instagram **profesional** (Creator o Business): Configuración → Tipo de cuenta.
- Cuenta de Facebook para entrar a developers.facebook.com.
- Un portfolio comercial (Meta Business) al que pertenezca la cuenta de Instagram y su página.

### 3.2 Crear la app
1. developers.facebook.com/apps → **Crear app**, caso de uso de Instagram, tipo Business.
2. Agregar el producto de Instagram.
3. En **Roles de la app → Roles**, un usuario de Instagram agregado como *Evaluador de Instagram*
   queda en estado **Pendiente** hasta que acepta la invitación desde esa cuenta
   (Instagram → Configuración → Apps y sitios web → Invitaciones de probador).

### 3.3 Dos caminos de token (importa para el host de la API)

| Camino | Token empieza con | Host | `META_GRAPH_BASE` |
|---|---|---|---|
| Instagram Login | `IGAA…` | `graph.instagram.com` | `https://graph.instagram.com/v23.0` |
| Facebook Login / usuario del sistema | `EAA…` | `graph.facebook.com` | **sin definir** |

El primer intento usó un token `EAA…` con `META_GRAPH_BASE` apuntando a `graph.instagram.com`:
Meta respondió *"Cannot parse access token"*. Se reconoció el tipo por el prefijo y se quitó la variable.

### 3.4 Camino usado: usuario del sistema de Meta Business
1. business.facebook.com/settings (el portfolio del negocio dueño de la cuenta de Instagram).
2. **Usuarios → Usuarios del sistema → Agregar**: nombre `Agencia Publicador`, rol *Employee*.
3. **Agregar activos** al usuario: la cuenta de Instagram (permiso de administrar contenido) y su
   página de Facebook.
4. **Generar token** para la app del portfolio, con **solo** estos permisos:
   `instagram_basic`, `instagram_content_publish` (y `pages_show_list`, `pages_read_engagement` si se
   ofrecen). Duración: 60 días mientras se prueba.
   Se **destildaron** `ads_management`, `ads_read`, `instagram_manage_messages` e
   `instagram_manage_comments` (mínimo permiso: Meta Ads queda para después).
5. Cargar `INSTAGRAM_ACCESS_TOKEN` y borrar `META_GRAPH_BASE`.
6. Anotar el `ig_user_id` (empieza con `17841…`) en `.claude/instagram-cuentas.json`.

### 3.5 Diagnóstico y errores (en el orden en que aparecieron)

| Síntoma | Causa | Solución |
|---|---|---|
| `Cannot parse access token` | token `EAA…` contra el host de Instagram Login | quitar `META_GRAPH_BASE` |
| `Object with ID '17841…' does not exist, cannot be loaded due to missing permissions` | el token pertenecía a un usuario del sistema de **otro** portfolio, sin ninguna cuenta asignada | crear el usuario del sistema en el portfolio correcto y asignarle la cuenta y la página |
| `/me/accounts` vacío | el token no tenía `pages_show_list` o no había páginas asignadas | asignar la página al usuario del sistema |
| rol *Evaluador de Instagram* en **Pendiente** | la invitación no se aceptó | aceptarla desde la cuenta de Instagram |

Lecturas de diagnóstico usadas (todas de solo lectura, con el token en el encabezado, sin mostrarlo):
`GET /me`, `/me/permissions`, `/me/accounts`, `/me/assigned_pages`, `/me/assigned_instagram_accounts`.

### 3.6 Verificación
Con el token correcto, `ver_cuenta` devolvió el usuario y la cuota (0 de 100 publicaciones por 24 h).
Eso confirmó la lectura. La publicación real de un carrusel de 2 placas también funcionó (con un store
de Blob público y el plan aprobado); la API devolvió el `media_id` y el enlace de la publicación.

## 4. Vercel Blob — `BLOB_READ_WRITE_TOKEN`

Meta descarga la imagen desde una URL pública, así que hay que alojarla.
1. vercel.com → Storage → **Create → Blob**.
2. Acceso **Public** (nombre sugerido `agencia-publicaciones`).
3. Copiar el `BLOB_READ_WRITE_TOKEN` del store y cargarlo como variable.

Error encontrado: el primer store se creó **privado** y la subida falló con
*"Cannot use public access on a private store"*. Un store no puede cambiar de privado a público:
hay que crear otro con acceso público. Con el store público, la subida respondió con URLs
`https://<id>.public.blob.vercel-storage.com/<cliente>/<archivo>-<sufijo>.png`, accesibles sin autenticación.

## 5. Pendientes de credenciales

- **Meta Ads** (`PIPEBOARD_API_TOKEN`, cuenta publicitaria y límite de gasto en Meta): decisión de
  dejarlo para el final.
- **Facebook y TikTok**: sin conector.
- **Revocar** el token de Glif que se compartió en un chat (generar otro y cargarlo) y el token anterior del otro usuario del sistema.
- **Renovar** el token de Meta antes de los 60 días.

Ver también [conectar-instagram.md](conectar-instagram.md) y [arquitectura.md](arquitectura.md).
