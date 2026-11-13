# Faro — panel web de la agencia

> Un faro guía y vigila a la vez: Faro es la cara visual del agente, y mantiene la regla de oro
> **human-in-the-loop** a la vista (nada se publica sin que lo apruebes acá).

Implementa el epic **PFMGN-71** (React + Express + WebSockets + auth).

## Qué hace (v0.1)

| Sección | Función |
|---|---|
| **Clientes** | Tarjetas con planes pendientes/aprobados y última actividad de cada cuenta (`clientes/*`). |
| **Cliente → Planes** | Lee los `historial/*.plan.json`, muestra hook, captions y checklist de marca, y permite **Aprobar / Rechazar** (escribe `aprobado` en el JSON y deja rastro en `registro-actividad.log`; es el mismo archivo que valida el hook `validar-publicacion.ps1`). |
| **Cliente → Calendario / Perfil / Aprendizajes / Actividad** | Vista de los `.md` y del log de auditoría. |
| **Agente** | Elegís un skill (`/crear-post`, `/plan-del-dia`, …), cliente y argumentos; se ejecuta Claude Code en `agencia/` y ves la salida en vivo por WebSocket. Podés responderle al agente (continúa la misma sesión) o cancelar. |

## Sesión del agente

- La consola del agente **sigue activa al navegar** por el panel: el historial, el skill elegido y la ejecución en curso no se pierden al ir a Clientes o a un cliente. En la barra lateral, «Agente» muestra **ejecutando** mientras corre un skill y **terminó** (punto verde) si terminó mientras mirabas otra vista; el título de la pestaña también lo indica.
- Una ejecución **solo se cancela** con el botón *Cancelar* o al cerrar o recargar la pestaña (el navegador avisa antes). Se sigue ejecutando un skill a la vez por conexión.

## Pedidos del agente: se resuelven desde la app

Cuando el agente necesita algo del operador, el pedido aparece como una **tarjeta** en la consola (y «Agente» muestra **responder** en la barra lateral y en el título de la pestaña, aunque estés en otra vista):

- **Pregunta con opciones** (lo que en la terminal sería `AskUserQuestion`): elegís una opción, varias si la pregunta lo permite, o escribís la tuya en «Otro», y **Enviar respuesta**. También podés **Cancelar pregunta**.
- **Permiso para usar una herramienta** (escribir un archivo, correr un comando, usar un conector que no esté permitido): ves qué quiere hacer y elegís **Permitir**, **Denegar** o **Permitir siempre en esta sesión** (esta última solo aparece si Claude Code la ofrece).

Detrás se usa el protocolo del SDK de Claude Code (`--permission-prompt-tool stdio` con entrada y salida `stream-json`): Faro solo reenvía respuestas a pedidos que el propio Claude Code emitió, valida las opciones contra las preguntas hechas y nunca acepta permisos «siempre» armados por el navegador. Los hooks de `.claude/hooks/` siguen actuando igual.

## Sesiones guardadas

- El servidor guarda cada sesión (su historial y su id) en `ui/.faro-data/sesiones/` (ignorado por git; se conservan las 50 más recientes).
- Al abrir el panel se preselecciona el cliente de la **última sesión** y se ofrece **Continuar la última sesión**; **Sesiones anteriores** lista las anteriores (filtradas por el cliente elegido) para **Abrir** o **Eliminar**.
- Abrir una sesión recupera su historial completo y la conversación sigue con `--resume`. Una sesión solo se puede continuar si está guardada en el servidor.

## Requisitos

- **Node.js 20 o superior** (probado con 24).
- **Claude Code CLI** (`claude`) instalado, en el PATH y con sesión iniciada — solo para la sección *Agente*.
- Los conectores que use cada skill (Drive, Calendar, Jira, Canva, Instagram…) configurados como indica
  [`../docs/obtencion-de-credenciales.md`](../docs/obtencion-de-credenciales.md). Las API keys siguen en
  variables de entorno del sistema, nunca en este panel.
- Windows, macOS o Linux. Navegador moderno.

## Uso

```bash
cd agencia/ui
npm install
npm run build
npm start
```

Abrí la URL que imprime la consola (`http://localhost:4310/?token=…`). El token se guarda en
`ui/.faro-token` (ignorado por git) y el navegador lo recuerda.

Desarrollo con recarga: `npm run dev` (panel en `http://localhost:5173`, API en `:4310`).
Tests: `npm test`.

## Variables de entorno

| Variable | Default | Uso |
|---|---|---|
| `FARO_PORT` | `4310` | Puerto del servidor. |
| `FARO_TOKEN` | generado | Token de acceso (si no, se genera y guarda). |
| `FARO_PERMISSION_MODE` | `acceptEdits` | Modo de permisos con el que se lanza `claude -p`. |
| `FARO_CLAUDE_BIN` | `claude` | Ruta al ejecutable de Claude Code. |
| `FARO_MODEL` | el de Claude Code | Modelo con el que se lanza el agente (por ejemplo `haiku` para pruebas baratas). |
| `FARO_DATA_DIR` | `ui/.faro-data/sesiones` | Carpeta donde se guardan las sesiones. |
| `AGENCIA_ROOT` | carpeta `agencia/` | Raíz de datos del agente. |

## Seguridad

- El servidor escucha **solo en 127.0.0.1** y exige token (API y WebSocket); el WebSocket valida el origen.
- Los nombres de cliente y archivos de plan se validan con lista estricta (sin `..`).
- Solo se pueden lanzar skills que existen en `.claude/skills/`; el prompt va por stdin, no por la línea de comandos.
- Los hooks de `.claude/hooks/` siguen siendo la barrera técnica: aunque el panel lance un skill, publicar
  o gastar sigue bloqueado sin aprobación registrada.

## Estructura

```
ui/
├── server/   data.js (lectura/aprobación) · runner.js (claude + pedidos) · conexion.js (una conexión WS) ·
│             sesiones.js (almacén) · entradas.js (historial) · index.js (API + WS) · *.test.js
└── web/src/  App.jsx · Planes.jsx · Consola.jsx · Solicitud.jsx · Md.jsx · styles.css
```

## Limitaciones conocidas

- Una ejecución de skill a la vez por conexión.
- Los pedidos de permiso solo se pueden contestar mientras la ejecución está en curso; si cerrás o recargás la pestaña,
  la ejecución se cancela (la sesión queda guardada y se puede continuar).
- No se guardan los pedidos que estaban sin responder al cancelar: al continuar, el agente vuelve a pedirlos si los necesita.
- Todavía sin métricas/dashboard ni gestión de usuarios (un solo operador con token).
