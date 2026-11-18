---
name: reporte-semanal
description: Genera un informe semanal de performance orgánica para un cliente, leyendo la auditoría de actividad y el Calendar del cliente. Resume qué se publicó, arma 3 conclusiones y 3 recomendaciones, y anota los datos en el historial mensual de la cuenta.
tools: Read, Write, mcp__gworkspace__*, AskUserQuestion
---

# /reporte-semanal

Arma el reporte semanal de una cuenta (métricas orgánicas).

## Uso

```
/reporte-semanal <cliente> [semana-opcional]
```

- `<cliente>`: nombre de la carpeta en `clientes/<cliente>/`.
- `[semana-opcional]`: rango de fechas `AAAA-MM-DD..AAAA-MM-DD`. Si no se da, se usan los
  últimos 7 días.

## Procedimiento

1. **Leer `registro-actividad.log`** del cliente y filtrar las entradas de la semana objetivo:
   qué se publicó (o qué planes/tareas se generaron, si todavía no hay conector de publicación
   real — Fase 1 registra esto igual como planes aprobados).

2. **Leer eventos del Calendar** del cliente en ese rango, para cruzar lo planificado con lo
   efectivamente marcado como hecho.

3. **Nota sobre métricas de alcance**: mientras no haya conector de publicación con métricas
   reales, **no hay alcance/interacción real disponible**. El reporte debe decirlo
   explícitamente en vez de inventar números — se limita a reportar cumplimiento
   (cuánto de lo planificado se ejecutó, con qué fricción) hasta que existan datos reales.

4. **Armar el informe**:
   - Resumen de piezas planificadas/publicadas esa semana, por formato y pilar.
   - 3 conclusiones (basadas en cumplimiento y fricción de producción, no en métricas
     inventadas).
   - 3 recomendaciones para la semana siguiente.

5. **Presentar el informe al usuario** antes de darlo por cerrado — puede corregir o agregar
   contexto que el sistema no ve.

6. **Guardar los datos** en `clientes/<cliente>/historial/<AAAA-MM>.md`, agregando la sección de
   esta semana (no reemplazando semanas anteriores del mismo archivo mensual).

## Reglas

- Nunca reportar una métrica de alcance/interacción como si fuera real cuando no hay
  conector de publicación con métricas conectado — decir explícitamente "sin datos de alcance
  todavía" en ese caso.
- El historial que genera este skill es el que `/cierre-mensual` consolida a fin de mes, y el
  que `/campania-mensual` lee antes de planificar el mes siguiente.
