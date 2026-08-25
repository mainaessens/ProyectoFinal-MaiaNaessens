# Fase 5 — Diseño con Canva

**Estado:** construida en modo plan; bloqueada para funcionar de punta a punta hasta que se
conecte una cuenta real de Canva (PFMGN-42) y se diseñen las plantillas maestras (PFMGN-43).

## Arquitectura

```
/crear-post
   │
   ├─ copywriter (hook + caption) ──┐
   │                                 │
   ├─ disenador ─────────────────────┼──► pieza gráfica (o nota "diseño pendiente")
   │    prioridad:                   │
   │    1. foto real del cliente     │
   │    2. plantilla Canva sin foto  │
   │    3. imagen IA (Glif, Fase 6)  │
   │                                 │
   ├─ horario-optimo (Calendar) ─────┤
   │                                 │
   └─ community-manager ─────────────┴──► .plan.json (aprobado, sin publicar)
```

## Componentes

- **`agents/disenador.md`**: subagente responsable de la pieza gráfica. Aplica siempre la
  prioridad foto real → plantilla sin foto → imagen IA, y declara explícitamente cuál usó.
- **`skills/crear-post/SKILL.md`**: agrega el paso 4 (producir la pieza) al pipeline existente
  de la Fase 1. Si Canva no está conectado, el `.plan.json` incluye una sección `"diseno"` con
  `"diseno_pendiente": true` en vez de fallar o inventar una pieza.

## Por qué "modo plan" para Canva

Mismo patrón que la Fase 1 con Late/Postiz: el conector real requiere una cuenta y OAuth que
son responsabilidad del usuario, no algo que el agente pueda resolver por sí mismo. En vez de
bloquear todo el pipeline de `/crear-post` hasta que eso exista, el sistema sigue generando y
aprobando planes completos — dejando documentado exactamente qué plantilla y qué material se
usarían — para no perder ese paso del proceso ni tener que rehacer el resto cuando el conector
esté listo.

## Esquema del campo `diseno` en `.plan.json`

```json
{
  "diseno": {
    "fuente": "foto_cliente | plantilla_sin_foto | glif",
    "plantilla_canva": "<id o nombre de la plantilla usada/a usar>",
    "diseno_pendiente": true
  }
}
```

`diseno_pendiente` pasa a `false` (o se omite el campo) una vez que el conector de Canva esté
registrado y la pieza se haya generado realmente.

## Pendiente

| Historia | Bloqueo |
|---|---|
| PFMGN-42 | Conectar una cuenta de Canva (OAuth, acción del usuario) |
| PFMGN-43 | Diseñar 3 plantillas maestras por cliente en la interfaz de Canva (trabajo manual) |
| PFMGN-46 (parcial) | Validar con CEDITE que la paleta/tono de los diseños generados es correcta |
