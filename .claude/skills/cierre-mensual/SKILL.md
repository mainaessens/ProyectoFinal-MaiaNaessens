---
name: cierre-mensual
description: Consolida el mes de una cuenta — qué se publicó, qué formatos/temas/horarios rindieron mejor según los reportes semanales y la auditoría — y actualiza la memoria de aprendizajes del cliente. Es la pieza que hace que /campania-mensual planifique cada mes sabiendo qué le funciona a esa cuenta puntual, no en general.
tools: Read, Write, AskUserQuestion
---

# /cierre-mensual

Cierra el mes de una cuenta: consolida datos, propone 3 aprendizajes, y actualiza la memoria.

## Uso

```
/cierre-mensual <cliente> [mes]
```

- `<cliente>`: nombre de la carpeta en `clientes/<cliente>/`.
- `[mes]`: mes a cerrar en formato `AAAA-MM`. Si no se da, se usa el mes actual.

## Procedimiento

1. **Reunir los datos del mes**:
   - `clientes/<cliente>/registro-actividad.log` (todo lo publicado/creado ese mes).
   - `clientes/<cliente>/historial/<mes-anterior o reportes semanales del mes>.md`, si
     `/reporte-semanal` ya generó reportes durante el mes.
   - `clientes/<cliente>/calendario-editorial.md` (lo que se planificó vs. lo que efectivamente
     se publicó, comparando fechas).

   - `clientes/<cliente>/analisis/<mes>.md` y `<mes>.datos.json` (análisis de Instagram del
     community-manager, con métricas reales de la API). **Es la fuente preferida de rendimiento**;
     si el mes todavía no tiene análisis, ofrecer `/analisis-cuenta <cliente> <mes>` antes de cerrar.

   Si falta alguna fuente, decirlo explícitamente y trabajar con lo que sí hay — no inventar
   métricas que no se pudieron leer.

2. **Clasificar qué funcionó y qué no**: mejores y peores formatos, temas, horarios y hooks del
   mes, según los datos disponibles (alcance/interacción de los reportes semanales si existen;
   si no hay métricas todavía, basarse en cuántas piezas de cada pilar/formato se completaron
   sin fricción vs. cuántas requirieron muchas correcciones).

3. **Generar 3 aprendizajes principales**, cada uno accionable y específico de esta cuenta (no
   genérico de marketing). Ejemplo de formato: *"Los carruseles del pilar 'tips rápidos'
   tuvieron menos correcciones que los reels — priorizar ese formato el mes próximo."*

4. **Proponer recomendaciones** para el mes siguiente, conectadas a los aprendizajes.

5. **Presentar el informe completo al usuario** (`AskUserQuestion`) para que lo valide o corrija
   — el criterio humano puede matizar un dato que la métrica no ve (ej: un evento externo que
   afectó el alcance esa semana).

6. **Solo tras validación**:
   - Crear `clientes/<cliente>/historial/<mes>.md` con el detalle completo del mes.
   - Actualizar `clientes/<cliente>/aprendizajes.md`, agregando (no reemplazando) los nuevos
     aprendizajes al resumen acumulado de la cuenta.
   - Ejecutar `/sincronizar-drive <cliente>` para subir el cierre y los aprendizajes a Drive.

## Reglas

- Nunca inventar métricas de alcance/interacción que no existan en los datos disponibles — si
  no hay datos de rendimiento real (por ejemplo, todavía no hay reportes
  semanales), decirlo y basar los aprendizajes en lo que sí hay (fricción de producción,
  cumplimiento del calendario planificado, etc.).
- `aprendizajes.md` es un resumen acumulado: cada cierre mensual suma información, no borra la
  de meses anteriores.
- Este skill es el que consume `/campania-mensual` al planificar el mes siguiente — mantenerlo
  legible y concreto, no un informe extenso difícil de aprovechar.
