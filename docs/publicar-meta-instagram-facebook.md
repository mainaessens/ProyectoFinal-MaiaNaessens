# Crear la app de Meta para publicar en Instagram y Facebook (misma publicación en ambas)

Guía paso a paso: crear la app en Meta for Developers, conseguir **un solo token** que sirva para
publicar en la cuenta de Instagram y en la página de Facebook del cliente, y cargar las variables.

> Meta cambia los nombres de pantallas y casos de uso seguido. Si una etiqueta no coincide, buscá la
> equivalente. Los **permisos** y los **endpoints** de abajo sí son estables.
> Complementa a [conectar-instagram.md](conectar-instagram.md) y [obtencion-de-credenciales.md](obtencion-de-credenciales.md).

## 0. Cómo funciona (para entender qué se pide)

Con **una app + un token de usuario del sistema** (prefijo `EAA…`, host `graph.facebook.com`):

| Red | Qué se llama | Permisos |
|---|---|---|
| Instagram | `POST /{ig-user-id}/media` → `POST /{ig-user-id}/media_publish` | `instagram_basic`, `instagram_content_publish` (+ `instagram_manage_insights` para estadísticas) |
| Facebook | `POST /{page-id}/photos` (imagen), `/{page-id}/feed` (texto/carrusel), `/{page-id}/video_reels` (reel) | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` |

"La misma publicación en ambas" = el mismo caption y las mismas imágenes/video (URL pública), enviados
a las dos llamadas. No existe un endpoint único que publique en las dos redes: son dos llamadas
seguidas que hace el conector.

## 1. Requisitos previos

1. **Instagram profesional** (Business o Creator) del cliente.
2. **Página de Facebook** del cliente, **vinculada** a esa cuenta de Instagram
   (Instagram → Configuración → Cuentas vinculadas / Centro de cuentas, o desde la página:
   Configuración → Cuentas vinculadas).
3. **Portfolio comercial (Meta Business)** que sea dueño de ambos activos: business.facebook.com/settings
   → Cuentas → Cuentas de Instagram y Páginas (si no están, agregarlos).
4. Tu usuario de Facebook con **control total** sobre esa página y ese portfolio.
5. Cuenta en developers.facebook.com (iniciar sesión con tu Facebook → "Comenzar" → verificar teléfono/email).

## 2. Crear la app

1. developers.facebook.com/apps → **Crear app**.
2. Nombre de la app (ej. `Agencia Publicador`) y email de contacto. Asociar al **portfolio comercial** del paso 1.3.
3. **Casos de uso** (selección múltiple): marcar
   - **Administrar todo en tu página** (Facebook Pages API) → da `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
   - **Administrar mensajes y contenido en Instagram** (Instagram API con inicio de sesión de Facebook) → da `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`.
   - No marcar anuncios, mensajes de Messenger ni WhatsApp.
4. Si te pide tipo de app, elegí **Empresa (Business)**.
5. Crear la app. Queda en modo **Desarrollo** (está bien para publicar en tus propios activos).

### 2.1 Datos de la app
**Configuración de la app → Básica**: copiar el **ID de la app** y la **Clave secreta** (Mostrar). Completar
también *URL de la política de privacidad* y *Categoría* (los pide para pasar a modo Live y no estorban antes).

### 2.2 Agregar permisos al caso de uso
En **Casos de uso → (cada uno) → Personalizar → Permisos y funciones**, agregar con **Agregar** los 7 permisos:
`instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`,
`pages_read_engagement`, `pages_manage_posts`, `business_management` (este último solo si el portfolio
te lo exige para listar activos).

## 3. Modo Desarrollo vs. Live y App Review

- **Tus propios activos o los de personas con rol en la app** (administradores, desarrolladores,
  evaluadores): funciona con **acceso estándar**, sin App Review, en modo Desarrollo.
- Si la agencia publica en cuentas de **clientes que no tienen rol en tu app**, Meta exige **acceso
  avanzado**: **Verificación del negocio** + **App Review** de cada permiso (con video de uso), y pasar la
  app a **Live**. Es un trámite de días a semanas.
- Camino práctico para empezar: cada cliente agrega a tu app como Evaluador/Desarrollador, o te da
  acceso de socio en su portfolio y creás **el usuario del sistema en el portfolio donde están los activos**.
  Para la tesis, probá primero con cuentas propias o con un cliente que te dé acceso.

## 4. Roles (solo si tenés una cuenta de prueba)

Panel de la app → **Roles de la app → Roles → Agregar personas**. Un *Evaluador de Instagram* queda
**Pendiente** hasta que acepta: Instagram → Configuración → Apps y sitios web → Invitaciones de probador.

## 5. Conseguir el token (usuario del sistema)

Es el camino ya probado en este proyecto, y el que sirve para ambas redes.

1. business.facebook.com/settings → **Usuarios → Usuarios del sistema → Agregar** (nombre
   `Agencia Publicador`, rol *Empleado* alcanza; *Admin* solo si no te deja asignar activos).
2. **Agregar activos** al usuario del sistema:
   - **Páginas** → la página del cliente → permiso **Control total** (necesario para publicar).
   - **Cuentas de Instagram** → la cuenta del cliente → administrar contenido.
   - **Apps** → tu app → administrar app.
3. **Generar token** → elegir tu app → duración **60 días** (mientras probás) o **nunca vence** (para
   producción, si la opción aparece) → marcar **solo**:
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`,
   `pages_read_engagement`, `pages_manage_posts`.
4. Copiar el token (se muestra **una sola vez**). Empieza con `EAA…`. **No lo pegues en un chat ni en archivos.**
5. Cargarlo como variable (sección 7). Si se expuso, revocarlo y generar otro.

## 6. Obtener los IDs (no son secretos)

Con el token cargado, desde PowerShell (el token se lee de la variable; no se imprime):

```powershell
$t = [Environment]::GetEnvironmentVariable("INSTAGRAM_ACCESS_TOKEN","User")
$h = @{ Authorization = "Bearer $t" }
# Permisos concedidos
Invoke-RestMethod "https://graph.facebook.com/v23.0/me/permissions" -Headers $h
# Páginas asignadas (devuelve id y nombre de la página)
Invoke-RestMethod "https://graph.facebook.com/v23.0/me/accounts?fields=id,name,instagram_business_account" -Headers $h
```

- `id` de la página → **`facebook_page_id`**.
- `instagram_business_account.id` (empieza con `17841…`) → **`ig_user_id`**. Si `/me/accounts` viene vacío,
  usar `/me/assigned_pages` y `/me/assigned_instagram_accounts` (usuarios del sistema).
- Si la página no devuelve `instagram_business_account`, **no está vinculada** a Instagram (paso 1.2).

Anotarlos en `.claude/instagram-cuentas.json` junto al cliente, por ejemplo:

```json
{
  "mi-cliente": {
    "ig_user_id": "17841XXXXXXXXXXXX",
    "facebook_page_id": "1234567890123456"
  }
}
```
(El conector actual lee `ig_user_id`; `facebook_page_id` es el campo que usaría la parte de Facebook, ver sección 9.)

## 7. Variables de entorno

Reglas del proyecto: **solo variables de entorno del usuario, nunca archivos versionados ni chat.**
`.claude/.env.example` lista nombres con valor vacío.

| Variable | Qué es | Obligatoria |
|---|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | Token `EAA…` del usuario del sistema. **Sirve también para Facebook** (el conector obtiene el token de página con él) | sí |
| `INSTAGRAM_TOKEN_<CLIENTE>` | Token propio de un cliente (ej. `INSTAGRAM_TOKEN_MI_CLIENTE`), si es de otro portfolio | opcional |
| `META_APP_ID` | ID de la app (sección 2.1) | solo para renovar/verificar el token |
| `META_APP_SECRET` | Clave secreta de la app | solo para renovar/verificar el token. **Secreto** |
| `META_GRAPH_VERSION` | Versión de Graph API (por defecto `v23.0`) | no |
| `META_GRAPH_BASE` | **Dejar sin definir** con tokens `EAA…` | no |
| `BLOB_READ_WRITE_TOKEN` | Token del store **público** de Vercel Blob (Meta descarga las imágenes por URL) | sí |

Cargar (el comando no muestra nada, es normal):

```powershell
[Environment]::SetEnvironmentVariable("INSTAGRAM_ACCESS_TOKEN", "<token EAA…>", "User")
[Environment]::SetEnvironmentVariable("BLOB_READ_WRITE_TOKEN", "<token del store público>", "User")
[Environment]::SetEnvironmentVariable("META_APP_ID", "<id de la app>", "User")
[Environment]::SetEnvironmentVariable("META_APP_SECRET", "<clave secreta>", "User")
```

Comprobar que existen **sin mostrar el valor**, y reiniciar Claude Code para que las tome:

```powershell
[bool][Environment]::GetEnvironmentVariable("INSTAGRAM_ACCESS_TOKEN","User")
```

Agregar al final de `.claude/.env.example` (solo nombres):

```
META_APP_ID=
META_APP_SECRET=
```

Si el proyecto se despliega (Vercel, etc.), cargar las mismas variables en el panel del servicio, nunca en el repo.

## 8. Verificación (solo lectura primero)

1. `/me/permissions` debe listar los 6 permisos con `status: granted`.
2. `GET /{ig-user-id}?fields=username` → devuelve el usuario de Instagram.
3. `GET /{page-id}?fields=name,access_token` → devuelve la página y un **token de página**
   (si responde error de permisos, falta asignar la página al usuario del sistema con control total).
4. Cuota de IG: `GET /{ig-user-id}/content_publishing_limit` (100 publicaciones por 24 h).
5. Prueba de publicación con `confirmar:true` en una cuenta de prueba, siguiendo el flujo con aprobación humana del proyecto.

Prueba manual de las dos llamadas de publicación (en una cuenta de prueba):

```text
Instagram:  POST /{ig-user-id}/media         image_url=<https…>&caption=<texto>
            POST /{ig-user-id}/media_publish creation_id=<id devuelto>
Facebook:   POST /{page-id}/photos           url=<https…>&caption=<texto>&published=true   (con token de PÁGINA)
```

Carruseles en Facebook: subir cada foto con `published=false`, luego `POST /{page-id}/feed` con
`attached_media=[{"media_fbid":"…"},…]`. Reels en Facebook: `POST /{page-id}/video_reels` en 3 pasos (start / subida / finish).

## 9. Estado del conector del proyecto

El conector actual (`mcp/instagram-publisher/`) **publica solo en Instagram**. Para que el mismo plan
aprobado se publique también en la página de Facebook hay que sumar herramientas de Facebook
(imagen, carrusel, reel) y que `publicar_*` las llame después de Instagram, con `facebook_page_id`
tomado de `instagram-cuentas.json` y las mismas barreras (plan aprobado, no repetir, `confirmar:true`).
Si falla una de las dos redes, registrar el plan como *parcial* y bloquear el reintento de la que ya salió,
igual que hoy con las historias.

## 10. Errores frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `Cannot parse access token` | token `EAA…` contra `graph.instagram.com` | dejar `META_GRAPH_BASE` sin definir |
| `Object with ID '17841…' does not exist… missing permissions` | el usuario del sistema es de otro portfolio o no tiene la cuenta asignada | crearlo en el portfolio correcto y asignar activos |
| `(#200) … pages_manage_posts` | el token se generó sin ese permiso o sin control total de la página | regenerar el token con el permiso y asignar la página con control total |
| `/me/accounts` vacío | falta `pages_show_list` o la página no está asignada | asignar la página; usar `/me/assigned_pages` |
| Error al publicar en IG: *Media ID is not available* | el contenedor aún se procesa | esperar y reintentar `media_publish` (el conector ya espera) |
| `Cannot use public access on a private store` | el store de Blob es privado | crear otro store **público** |
| La app pide App Review | publicás en cuentas sin rol en la app | sección 3 |

## 11. Mantenimiento

- Token de 60 días: **renovar antes de que venza** (regenerar en el usuario del sistema) y recargar la variable.
- Rotar `META_APP_SECRET` si se expuso (Configuración de la app → Básica → Restablecer).
- Si cambia la versión de Graph API, ajustar `META_GRAPH_VERSION`.
