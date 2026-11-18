# Plan de testeo — Faro (panel web del agente), desde cero

**Alcance:** `agencia/ui` (React + Express + WebSocket), de punta a punta con un cliente nuevo
(`el-norteno-parquet`), desde el alta hasta la publicación en Instagram.
**Reglas del testeo:** una pieza real se publica **una sola vez**, al final (bloque G).
Anotá ✅ / ❌ en cada caso y, si falla, pegá el mensaje exacto de la consola.

## 0. Estado inicial (precondiciones)

| # | Verificación | Esperado |
|---|---|---|
| 0.1 | `ls clientes/` | Solo `plantilla/` |
| 0.2 | `node -v` y `claude --version` | Node ≥ 20 y `claude` en el PATH con sesión iniciada |
| 0.3 | Variables de entorno `INSTAGRAM_ACCESS_TOKEN`, `BLOB_READ_WRITE_TOKEN` | Presentes (ver solo si existen, no mostrar el valor) |
| 0.4 | `.claude/instagram-cuentas.json` | Tiene el `ig_user_id` de `el-norteno-parquet` |
| 0.5 | Conectores de Drive, Canva y Calendar | Autorizados |
| 0.6 | Carpeta de Drive del Norteño | Con brief y manual de marca |
| 0.7 | `ui/.faro-data/sesiones/` | Vacía o inexistente (sin sesiones previas) |

## A. Pruebas automáticas (antes de abrir el navegador)

| # | Comando | Esperado |
|---|---|---|
| A1 | `cd ui && npm test` | Todas las pruebas pasan (datos, conexión, runner, sesiones) |
| A2 | `cd ui && npm run build` | Compila sin errores |
| A3 | `tests\Run-Tests.ps1` desde `agencia/` | Suite del agente y de los hooks en verde |
| A4 | `node --test mcp/instagram-publisher/*.test.mjs` | Conector de Instagram en verde |

## B. Arranque y seguridad del panel

| # | Caso | Esperado |
|---|---|---|
| B1 | `npm start` en `ui/` | Imprime `http://localhost:4310/?token=…` y no hay errores |
| B2 | Abrir la URL con el token | Carga el panel; el token queda recordado al recargar |
| B3 | Abrir `http://localhost:4310/` sin token y en ventana privada | Rechaza el acceso (no muestra datos) |
| B4 | `GET /api/clientes` sin el header de token | 401 |
| B5 | Acceso desde otra IP de la red (`http://<ip-de-la-pc>:4310`) | No conecta (solo escucha en 127.0.0.1) |
| B6 | WebSocket desde otro origen (consola de otra página) | Rechazado por validación de origen |
| B7 | `GET /api/clientes/..%2f..%2fetc` y nombres con `..` | 400/404, nunca lee fuera de `clientes/` |
| B8 | Lanzar un skill que no existe (llamada manual a la API) | Rechazado: solo corren los de `.claude/skills/` |
| B9 | Reiniciar con `FARO_PORT=4311 npm start` | Usa el puerto nuevo |

## C. Vista Clientes (con el repositorio vacío)

| # | Caso | Esperado |
|---|---|---|
| C1 | Entrar a **Clientes** sin clientes | Mensaje de vacío, sin errores en consola |
| C2 | La plantilla no aparece como cliente | No hay tarjeta `plantilla` |

## D. Agente: alta del cliente (`/nuevo-cliente`)

Lanzar desde **Agente**: skill `/nuevo-cliente`, cliente `el-norteno-parquet`, argumento: URL de Drive.

| # | Caso | Esperado |
|---|---|---|
| D1 | Lista de skills y de modelos | Aparecen los skills y el modelo por defecto (el panel indica qué modelo usa) |
| D2 | Ejecución en vivo | La salida llega en tiempo real; se ve el nombre de cada herramienta que usa |
| D3 | Pedido de permiso | Aparece la tarjeta «Permiso» con la herramienta y el detalle; **Denegar** frena esa acción; **Permitir** continúa |
| D4 | «Permitir siempre en esta sesión» | No vuelve a preguntar por esa herramienta dentro de la sesión |
| D5 | Parada: orden del Drive | Muestra la tabla archivo → destino; **no** mueve nada hasta tu OK |
| D6 | Responder al agente desde el panel | Continúa la misma sesión (`--resume`) |
| D7 | Descarga de assets | `clientes/el-norteno-parquet/assets/fotos` y `videos` con el material; no duplica |
| D8 | Parada: perfil | Muestra el perfil con la fuente de cada dato y «pendiente» donde falta |
| D9 | Resultado en disco | Existen `perfil.md`, `calendario-editorial.md`, `aprendizajes.md`, `historial/`, `registro-actividad.log` |
| D10 | Diagnóstico de Instagram | Genera `analisis/baseline-<fecha>.md` o deja el estado «pendiente» con el motivo |
| D11 | Cancelar | El botón Cancelar frena la ejecución y el proceso hijo termina |

## E. Persistencia de la sesión (el problema corregido)

| # | Caso | Esperado |
|---|---|---|
| E1 | Con un skill corriendo, ir a **Clientes**, abrir el cliente y volver a **Agente** | La salida sigue ahí y el skill **no** se detuvo |
| E2 | Indicador de actividad | Se ve en la barra lateral que hay un skill corriendo, desde cualquier vista |
| E3 | Terminar un skill estando en otra vista | Hay un aviso al volver; se puede responder |
| E4 | Recargar la página (F5) con una sesión abierta | Se puede retomar la sesión anterior |
| E5 | Abrir una sesión anterior de la lista | Muestra el historial guardado y se puede continuar |
| E6 | Cerrar la pestaña con un skill corriendo | El proceso se corta (comportamiento esperado al cerrar la conexión) |
| E7 | Límite de una ejecución a la vez | Lanzar otro skill durante una ejecución se rechaza con un mensaje claro |

## F. Campaña y piezas

| # | Caso | Esperado |
|---|---|---|
| F1 | `/campania-mensual el-norteno-parquet <mes> <objetivo>` | Tabla numerada; **frena** hasta aprobar; recién ahí guarda el calendario |
| F2 | Cliente → **Calendario** | Muestra la tabla aprobada |
| F3 | `/crear-post el-norteno-parquet 1` | Hook, caption, diseño en Canva y revisión contra el perfil; **frena** para aprobar la pieza |
| F4 | «Pedir cambios» | Genera una versión nueva sin pisar la anterior |
| F5 | Aprobar la pieza | Exporta a `assets/exports/` y crea `historial/<fecha>-<slug>.plan.json` |
| F6 | `/crear-reel` con video real | Arma guion y plan; si no hay video adecuado, lo declara en vez de inventarlo |
| F7 | `/editar-video` sobre el reel | Plan por escenas; **sin** `aprobado_total:true` no exporta; el bruto no se modifica |
| F8 | `/crear-historias` | Genera el plan de historias |

## G. Aprobación y publicación (única publicación real)

| # | Caso | Esperado |
|---|---|---|
| G1 | Cliente → **Planes** | Muestra hook, captions y checklist de marca del plan |
| G2 | **Intento de publicar sin aprobar** | El hook `validar-publicacion` **bloquea**; no se publica |
| G3 | **Rechazar** un plan | Escribe el rechazo en el JSON y deja una línea en el log |
| G4 | **Aprobar** el plan | Escribe `aprobado` en el JSON y deja una línea en `registro-actividad.log` |
| G5 | Publicación: simulacro | `subir_archivo_publico` devuelve URL https; `publicar_imagen` **sin** `confirmar` no publica y muestra qué haría |
| G6 | Publicación: confirmada | Tras tu OK explícito, con `confirmar:true` publica; el caption sale del plan aprobado |
| G7 | Resultado en disco | Se crea `<plan>.publicado.json` y una línea en el log |
| G8 | En Instagram | La pieza está en la cuenta con la imagen y el caption correctos |
| G9 | Cliente → **Actividad** | Muestra el rastro completo: alta, aprobaciones y publicación |
| G10 | Segunda publicación del mismo plan | No republica sin una confirmación nueva |

## H. Errores y robustez

| # | Caso | Esperado |
|---|---|---|
| H1 | Quitar el token de Instagram (variable vacía) y publicar | Error claro («falta la variable de entorno…»), sin publicar |
| H2 | Token vencido o sin permisos | Mensaje de error de la Graph API con el token **oculto** (`<oculto>`) |
| H3 | Sesión de Claude Code vencida | El panel sugiere iniciar sesión de nuevo (`claude` → `/login`) |
| H4 | Herramienta MCP sin permiso en modo no interactivo | Aparece como pedido de permiso o error legible, no un cuelgue |
| H5 | Matar y reiniciar el servidor con un skill en curso | El panel avisa la desconexión y se reconecta; no queda un proceso `claude` huérfano |
| H6 | Aprobar dos veces el mismo plan | Idempotente: no corrompe el JSON |
| H7 | Cliente inexistente en el selector | Rechazo con mensaje, sin crear carpetas |

## I. Pruebas visuales y de uso

| # | Caso | Esperado |
|---|---|---|
| I1 | Ventana angosta (móvil/tablet) | El panel sigue siendo usable |
| I2 | Modo claro y oscuro | Legible en ambos |
| I3 | Consola del navegador durante todo el recorrido | Sin errores en rojo |

## Criterios de salida

- **Aprobado** si pasan todos los casos de A, B, D, E, F y G, y ningún caso de H deja el sistema en un
  estado inconsistente.
- Los casos ❌ se registran como tickets en Jira (proyecto PFMGN) bajo el epic de Faro (PFMGN-71)
  o el de extras (PFMGN-83), con el mensaje exacto y los pasos para reproducir.
- Al terminar: revisar `git status` y **no** subir `clientes/el-norteno-parquet/`,
  `.claude/instagram-cuentas.json` con IDs reales, `ui/.faro-token`, `ui/.faro-data/` ni `tests/resultados.xml`.

## Registro de resultados

| Bloque | Casos | ✅ | ❌ | Notas |
|---|---|---|---|---|
| A. Automáticas | 4 | | | |
| B. Arranque y seguridad | 9 | | | |
| C. Clientes | 2 | | | |
| D. Alta del cliente | 11 | | | |
| E. Persistencia de sesión | 7 | | | |
| F. Campaña y piezas | 8 | | | |
| G. Aprobación y publicación | 10 | | | |
| H. Errores | 7 | | | |
| I. Visual | 3 | | | |
