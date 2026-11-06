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
├── server/   data.js (lectura/aprobación) · runner.js (claude -p) · index.js (API + WS) · data.test.js
└── web/src/  App.jsx · Planes.jsx · Consola.jsx · Md.jsx · styles.css
```

## Limitaciones conocidas

- Una ejecución de skill a la vez por conexión.
- En modo no interactivo, `claude -p` no puede mostrar diálogos de permisos: las herramientas MCP que no estén
  permitidas en `settings.json` se rechazan. Si un skill falla por eso, agregá el permiso correspondiente.
- Todavía sin métricas/dashboard ni gestión de usuarios (un solo operador con token).
