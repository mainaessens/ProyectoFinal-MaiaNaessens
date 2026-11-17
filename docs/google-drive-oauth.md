# Credenciales de Google Drive para `descargar-assets.ps1`

El script necesita un token de **solo lectura** de la API de Drive. El conector de Drive de la
plataforma no sirve para bajar muchos archivos (devuelve cada uno en base64 al chat). Las
credenciales se guardan en `.claude/.env` (ignorado por git); nunca en el repo ni en el chat.

Variables (ver `.claude/.env.example`):

| Variable | Uso |
|---|---|
| `GOOGLE_ACCESS_TOKEN` | token suelto, dura ~1 h |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | el script renueva el token solo en cada corrida |

## Opción A — Token rápido (1 hora)

1. Abrir <https://developers.google.com/oauthplayground>.
2. Paso 1: escribir el scope `https://www.googleapis.com/auth/drive.readonly`, **Authorize APIs** y
   aceptar con la cuenta dueña del Drive.
3. Paso 2: **Exchange authorization code for tokens**.
4. Copiar el *Access token* (`ya29....`) a `GOOGLE_ACCESS_TOKEN` en `.claude/.env`.

El Playground usa credenciales propias y revoca los refresh tokens a las 24 h; sirve para una
descarga puntual.

## Opción B — Credenciales propias con refresh token

Un refresh token no vence a los pocos días solo si la app está **In production**; en *Testing*
vence a los 7 días.

1. **Proyecto y API.** En <https://console.cloud.google.com> crear (o elegir) un proyecto y habilitar
   *Google Drive API*: `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=<PROJECT_ID>`.
2. **Cliente OAuth.** En `https://console.cloud.google.com/auth/clients?project=<PROJECT_ID>`:
   configurar la pantalla de consentimiento (nombre de la app, mail de soporte, audiencia
   *External*, mail de contacto) y **Create client → Web application** con el URI de redirección
   autorizado exacto `https://developers.google.com/oauthplayground`. Copiar Client ID y secret.
3. **Branding** (`.../auth/branding?project=<PROJECT_ID>`), necesario para poder publicar:
   - App name, User support email y Developer contact email.
   - **Application home page** y **Application privacy policy link**: URLs **públicas** (abren sin
     iniciar sesión). La política es [PRIVACY.md](../PRIVACY.md) de este repo, pero si el repo es
     privado esa URL no sirve: alojarla en una página pública (por ejemplo un gist público).
   - **Authorized domains**: el dominio de esas URLs.
   - Dejar vacíos el logo y los términos de servicio (el logo obliga a pasar por verificación).
4. **Publicar.** En `.../auth/audience?project=<PROJECT_ID>` tocar **Publish app** (debe quedar *In
   production*). Si no se habilita, falta algún dato del paso 3.
5. **Refresh token.** En el Playground, engranaje → *Use your own OAuth credentials* → pegar Client
   ID y secret → repetir la opción A hasta el *Exchange*. Copiar el *Refresh token*.
6. Guardar en `.claude/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.

Al autorizar puede aparecer "Google no verificó esta app": es esperable para uso personal
(*Avanzado → Continuar*).

## Opción C — Cuenta de servicio (sin pantalla de consentimiento ni vencimiento)

No requiere branding ni publicación. Cada carpeta de cliente se comparte con el mail de la cuenta
como *Viewer*. Requiere que el script firme un JWT con la llave (pendiente de implementar).

1. `https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=<PROJECT_ID>` →
   crear `drive-lector`.
2. En la cuenta: **Keys → Add key → JSON**; guardar el archivo fuera del repo.
3. Compartir la carpeta del cliente en Drive con el mail de la cuenta, como lector.

## Si se filtró un token

Revocar en <https://myaccount.google.com/permissions> (buscar la app o "OAuth 2.0 Playground") y
generar otro.
