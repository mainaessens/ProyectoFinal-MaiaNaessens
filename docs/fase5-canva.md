# Fase 5 — Diseño con Canva

**Estado:** conector de Canva conectado y verificado (PFMGN-42). 3 plantillas maestras de
prueba generadas para `cedite-drive-test` (PFMGN-43): post, carrusel y portada de historia.
`/crear-post` genera piezas reales en Canva cuando el conector está disponible, y cae a modo
plan (`diseno_pendiente: true`) si no lo está — ver sección "Modo plan" más abajo, que sigue
vigente como comportamiento de resiliencia del sistema aunque hoy Canva ya esté conectado.

**Importante — separación de cuentas:** la cuenta de Canva conectada es la cuenta real de la
agencia, con los brand kits de clientes reales. El sistema **nunca usa esos brand kits** —
todas las plantillas de prueba se generan sin
`brand_kit_id`, describiendo la paleta del cliente de prueba directamente en el prompt. Ningún
diseño ni brand kit real fue tocado durante el desarrollo/testing de esta fase.

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

Mismo patrón que la Fase 1: el conector real requiere una cuenta y OAuth que
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
| PFMGN-46 (parcial) | Validar con CEDITE (cliente institucional real) que la paleta/tono de los diseños generados es correcta — sigue pendiente de esa sesión real |
| PFMGN-76 | Publicación real en Instagram (Graph API oficial) — las piezas ya se generan; la primera publicación real sigue pendiente |
