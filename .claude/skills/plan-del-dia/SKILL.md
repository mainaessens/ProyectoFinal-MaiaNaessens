---
name: plan-del-dia
description: Lee Google Calendar de un cliente (o de todos los clientes activos) y el estado de sus piezas en calendario-editorial.md, y arma una lista priorizada de qué hay que hacer hoy y en la próxima semana. Solo lectura — nunca modifica Calendar; solo cambia el estado de una pieza en calendario-editorial.md si el usuario lo pide explícitamente, y queda registrado en el log de actividad del cliente.
tools: Read, Write, mcp__gworkspace__*
---

# /plan-del-dia

Arma la lista priorizada de trabajo del día (y un vistazo a la semana) para un cliente.

## Uso

```
/plan-del-dia <cliente> [fecha-opcional]
```

- `<cliente>`: nombre de la carpeta en `clientes/<cliente>/`.
- `[fecha-opcional]`: fecha en formato `AAAA-MM-DD`. Si no se da, se usa la fecha actual.

## Procedimiento

1. **Leer `clientes/<cliente>/perfil.md`** y obtener de la sección "Organización" el ID del
   calendario de Google (`google_calendar_id`).

   Si no está completado, avisar cómo obtenerlo (`docs/conectar-calendar.md`) y continuar solo con
   el estado de `calendario-editorial.md`; no bloquear el skill por falta de un dato.

2. **Leer eventos de Calendar** (`gworkspace`) del calendario del cliente, filtrando entre la
   fecha objetivo y 7 días después.

3. **Leer `clientes/<cliente>/calendario-editorial.md`** para el estado de cada pieza (Por hacer,
   En diseño, En aprobación, Programado, Publicado) y cruzarlo con los eventos por fecha y título.

4. **Unificar en una sola vista**, por fecha: cada evento con su horario, su pieza y su estado.
   Dentro de un mismo día, en orden de horario. Marcar las piezas que tienen fecha pasada y no
   figuran como publicadas, y los eventos sin pieza en el calendario editorial.

5. **Separar visualmente "Hoy" del resto de la semana.**

6. **Presentar la lista** al usuario, agrupada por cliente si se corrieron varios clientes a la
   vez. No se modifica nada todavía en este paso.

7. **Si el usuario pide marcar una pieza como "en curso" o "completada"**: cambiar su estado en
   `calendario-editorial.md` y agregar una línea a `clientes/<cliente>/registro-actividad.log` con
   fecha, pieza y el cambio de estado. El evento de Calendar no se toca.

## Reglas

- Este skill **nunca** crea, edita ni borra eventos de Calendar por su cuenta. La única escritura
  permitida es el cambio de estado en `calendario-editorial.md` que el usuario pida
  explícitamente en el paso 7, y siempre queda registrada en el log de actividad.
- Si Calendar devuelve error (token vencido, calendario no encontrado, sin permiso), mostrar el
  error claramente y seguir con lo que sí se pudo leer del calendario editorial — no fallar todo
  el skill por un conector caído.
- Si se corre sin especificar cliente, se puede ofrecer correr el plan para todos los clientes
  con `clientes/<nombre>/perfil.md` existente, uno por uno.
