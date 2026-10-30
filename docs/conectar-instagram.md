# Conectar Instagram (publicación automática)

Conector propio: `mcp/instagram-publisher/` (Node, sin dependencias) sobre la Instagram Graph API
oficial de Meta. Publica solo el caption de un `.plan.json` **aprobado**, una vez por plan.

## Qué necesitás

1. **Cuenta de Instagram Business o Creator**, vinculada a una página de Facebook. Para probar,
   una cuenta propia, nunca la de un cliente.
2. **App en developers.facebook.com** (tipo Business) con el caso de uso de Instagram y los
   permisos de publicación (`instagram_content_publish` o `instagram_business_content_publish`).
   En modo desarrollo alcanza con tu propia cuenta; la revisión de Meta solo hace falta para
   publicar en cuentas ajenas (confirmarlo en la documentación de Meta antes de ir con clientes).
3. **Token de acceso** de esa app para la cuenta de Instagram, y su **`ig_user_id`**.
4. **Dónde alojar las imágenes**: Meta descarga el medio desde una URL https pública. El conector
   usa Supabase Storage: un bucket público `publicaciones`.

## Variables de entorno (las cargás vos; nunca en archivos ni en el chat)

```powershell
[Environment]::SetEnvironmentVariable("INSTAGRAM_ACCESS_TOKEN", "<token>", "User")
[Environment]::SetEnvironmentVariable("SUPABASE_URL", "https://<proyecto>.supabase.co", "User")
[Environment]::SetEnvironmentVariable("SUPABASE_KEY", "<clave con permiso de subida al bucket>", "User")
```

Y el `ig_user_id` (no es secreto) en `.claude/instagram-cuentas.json`.

**Dos caminos de login en Meta** (cambia el host de la API):

- **Instagram Login** (recomendado, no requiere página de Facebook): token generado en el panel
  de la app. Hay que apuntar el conector a ese host:
  `META_GRAPH_BASE=https://graph.instagram.com/v23.0`
- **Facebook Login** (cuenta vinculada a una página): es el host por defecto
  (`https://graph.facebook.com/v23.0`), no hace falta variable.

La versión de la API (`v23.0`) se cambia con `META_GRAPH_VERSION` si Meta la retira.

## Probar sin riesgo

1. `ver_cuenta` → debe mostrar tu usuario y la cuota de publicación (solo lectura).
2. `publicar_imagen` **sin** `confirmar` → simulacro: muestra qué se publicaría.
3. Con tu OK, `publicar_imagen` con `confirmar:true` sobre un plan de prueba, en tu cuenta de prueba.
4. Intentar publicar un plan no aprobado o ya publicado → debe bloquearse.

## Barreras

- Hook `validar-publicacion.ps1` (exige plan aprobado del cliente) **y** el propio conector
  (valida plan aprobado, cliente correcto, no publicado antes, https, fecha programada).
- El caption nunca viene del chat: sale del plan aprobado.
- El token no aparece en errores ni en logs.

## Tests

`node --test mcp/instagram-publisher` (17 tests con Graph API y Supabase simulados). No hay
tests contra Meta real: la primera prueba real es la de arriba.
