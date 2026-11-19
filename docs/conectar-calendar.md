# Conectar el Google Calendar de un cliente

Cada cliente tiene **su propio calendario de Google** donde se agenda cada pieza del mes
(reel, carrusel, historia, posteo). Es el único lugar de organización diaria del agente: **no se usa
Jira por cliente** (Jira queda solo para el tablero de la tesis, proyecto PFMGN). El estado de cada
pieza (`Por hacer → En diseño → En aprobación → Programado → Publicado`) vive en
`clientes/<cliente>/calendario-editorial.md`; la fecha y la hora, en el evento de Calendar.

El único dato que hay que conectar es el **ID del calendario** (`google_calendar_id`), en el
`perfil.md` del cliente, sección *Organización*.

## 1. Crear el calendario del cliente

1. Abrir [calendar.google.com](https://calendar.google.com) con la cuenta conectada al agente
   (la misma del conector *Google Drive / Calendar*).
2. A la izquierda, en **Otros calendarios**, tocar **+** → **Crear calendario nuevo**.
3. Nombre: `Agencia – <Cliente>` (por ejemplo `Agencia – El Norteño Parquet`). Zona horaria del
   cliente (Argentina: `(GMT-03:00) Hora de Argentina – Buenos Aires`). **Crear calendario**.

> Si el cliente ya tiene un calendario propio para sus publicaciones, se puede usar ese: solo
> hay que compartirlo (paso 3).

## 2. Obtener el ID

1. Pasar el mouse sobre el calendario en la lista de la izquierda → **⋮** → **Configuración y uso
   compartido**.
2. Bajar hasta **Integrar el calendario** → copiar el **ID de calendario**. Tiene esta forma:

   ```
   a1b2c3d4e5f6@group.calendar.google.com
   ```

   El calendario principal de una cuenta usa su correo como ID (por ejemplo `nombre@gmail.com`).

**Atajo:** pedirle al agente *«listá mis calendarios»*. Usa `list_calendars` del conector y muestra
nombre e ID de cada uno; solo hay que elegir el del cliente.

## 3. Dar permiso de escritura

El agente crea los eventos con la cuenta del conector. Si el calendario es de **otra cuenta**
(por ejemplo, del cliente):

1. En **Configuración y uso compartido** → **Compartir con determinadas personas** → **Agregar
   personas**.
2. Poner el correo de la cuenta del conector con el permiso **Hacer cambios en los eventos**.

Con un permiso de solo lectura, `/plan-del-dia` funciona pero `/campania-mensual` no puede crear
eventos.

## 4. Registrarlo en el perfil

En `clientes/<cliente>/perfil.md`:

```markdown
## Organización

- **ID de Google Calendar:** a1b2c3d4e5f6@group.calendar.google.com
```

`/nuevo-cliente` lo pregunta al dar de alta al cliente (sección D, paso 5) y, si no se tiene todavía,
lo deja como **pendiente**: el resto del alta no se bloquea.

## 5. Probar la conexión

```
/plan-del-dia <cliente>
```

Si el ID es correcto, muestra los eventos de la semana (vacía, si todavía no hay ninguno). Si da
error de calendario no encontrado o sin permiso, revisar los pasos 2 y 3. Es de solo lectura:
no crea ni modifica nada.

## Qué agenda el agente

`/campania-mensual`, **solo después de que se aprueba la tabla completa** (regla de oro
*proponer → revisar → ejecutar*), crea un evento por cada fila:

| Campo | Contenido |
|---|---|
| Título | `[Formato] Tema` — por ejemplo `[Reel] Cómo cuidar el parquet` |
| Fecha y hora | La propuesta aprobada (horario de `.claude/agents/horario-optimo.md`) |
| Descripción | Resumen de la ficha de la pieza: hook, CTA, materiales y qué falta |
| Eventos de apoyo | Si la pieza depende de alguien (filmación, revisión experta, aprobación del cliente), un evento aparte con esa fecha límite |

Cada creación, modificación o borrado de eventos queda en
`clientes/<cliente>/registro-actividad.log` (hook `registrar-actividad.ps1`).

## ¿Por qué no Jira?

El agente trabaja con un solo cliente a la vez y el calendario ya da fecha, hora y recordatorios.
Duplicar cada pieza como tarea en Jira exigía un proyecto por cliente, un flujo de estados y otra
conexión por mantener, sin aportar nada que no estuviera en el calendario y en
`calendario-editorial.md`. Si más adelante se necesita un tablero, se puede volver a agregar sin
tocar el resto.
