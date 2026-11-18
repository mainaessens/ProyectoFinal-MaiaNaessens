# Fases 1 y 6 — estado (2026-11-04)

| Fase | Pieza | Estado |
|---|---|---|
| 1 — Publicación | Conector propio de Instagram (`mcp/instagram-publisher/`): imagen, **carrusel**, reel, subida a Vercel Blob | Lectura, subida a Blob y **publicación de un carrusel verificadas contra servicios reales** (2026-11-04); imagen y reel solo con simulados |
| 6 — Imágenes IA (Glif) | Regla de prioridad en `CLAUDE.md`, "Estilo IA" en el perfil, `assets/ia/`, máximo 2 variantes y reutilización en `agents/disenador.md` | Verificado contra Glif real (2026-11-04): servidor alojado `glif.app/api/mcp`, 1 imagen con `compose_project` (5,1 créditos), integrada en una pieza de Canva (criterio de necesidad de 3 condiciones, declaración `imagen_ia` en el plan). El paquete npm local está obsoleto |
| Extra — `/crear-reel` | Guion, video real del cliente, portada Canva, plan | Escrito; dry-run con datos de prueba |

## Pendiente externo

- Revocar el token de Glif compartido en un chat.
- Facebook: sin conector.
- Rutina que ejecute las publicaciones a su hora (la API de Instagram publica al instante).

Ver [arquitectura.md](arquitectura.md) y [flujo-de-trabajo.md](flujo-de-trabajo.md).
