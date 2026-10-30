---
name: lanzar-campania-ads
description: Lanza una campaña de anuncios en Meta Ads para un cliente con doble barrera humana. Arma la propuesta completa (estructura, audiencias, creativos tomados del contenido orgánico que mejor rindió, presupuesto desglosado), exige que el usuario CONFIRME ESCRIBIENDO el monto exacto, crea la campaña EN PAUSA y solo la activa tras una segunda confirmación. El hook validar-publicacion.ps1 verifica la aprobación, el monto, el tope mensual y el estado en pausa.
tools: Read, Write, AskUserQuestion, mcp__meta-ads__*
---

# /lanzar-campania-ads

La única acción del sistema que mueve dinero real. Va al final del roadmap a propósito.

## Uso

```
/lanzar-campania-ads <cliente> <objetivo> <monto> <duración>
```

Ejemplo: `/lanzar-campania-ads lumbre-pilates "dar a conocer el estudio" 150 14d`.

## Requisitos (si falta alguno, detenerse e informar)

- `perfil.md` con **ID de cuenta publicitaria** y límite de gasto acordado.
- `.claude/limites.json` con `tope_mensual > 0` para el cliente.
- Límite de gasto configurado en la propia cuenta de Meta (primera barrera, externa al agente).
- Fase 7 corriendo (datos de rendimiento disponibles); si no hay historial, decirlo.

## Procedimiento (subagente `ads-manager`)

1. **Brief**: confirmar objetivo, público, presupuesto total, duración y red (IG/FB).
2. **Propuesta completa**, sin ejecutar nada: estructura (campaña → conjuntos → anuncios),
   audiencias, creativos (el contenido orgánico que mejor rindió, citando su métrica),
   presupuesto desglosado por conjunto y por día, fechas, y cuánto del tope mensual consume.
   Pasar `checklist-marca.ps1` sobre los textos de los anuncios.
3. **Primera confirmación — el monto escrito**: pedir al usuario que escriba el monto total
   exacto (ej. `150`). Si no coincide con el de la propuesta, no continuar. Un "sí" o "ok" no
   alcanza.
4. **Registrar la aprobación**: escribir `clientes/<cliente>/historial/<fecha>-<slug>.ads.json`
   ```json
   {
     "cliente": "<cliente>",
     "aprobado": true,
     "fecha_aprobacion": "AAAA-MM-DD",
     "monto_confirmado": 150,
     "duracion_dias": 14,
     "activacion_confirmada": false,
     "propuesta": "resumen o ruta de la propuesta"
   }
   ```
5. **Crear EN PAUSA**: llamar al conector con `cliente` y `status: PAUSED` (el hook bloquea si
   falta la aprobación, el monto la excede, se supera el tope del mes, o el estado no es pausa).
6. **Revisión**: indicar al usuario que revise la campaña en Ads Manager.
7. **Segunda confirmación — activar**: solo si el usuario lo pide explícitamente, preguntar de
   nuevo; si confirma, poner `activacion_confirmada: true` en el `.ads.json` (nuevo archivo si
   el original ya existía, para mantener trazabilidad) y recién ahí llamar a la activación.
8. Registrar en `registro-actividad.log` el monto, la campaña y su estado.

## Reglas

- Proponer → revisar → ejecutar. Las campañas **nunca** se crean activas.
- Nunca crear con un monto distinto al confirmado ni sin `.ads.json` aprobado.
- Un `.ads.json` aprobado es inmutable: un cambio de monto genera uno nuevo.
- Si el hook bloquea, informar el motivo y detenerse; no reintentar con otro camino.
- **Simulacro previo** (una vez por instalación): crear y borrar una campaña pausada de monto
  mínimo para comprobar las dos barreras antes del primer cliente real.
