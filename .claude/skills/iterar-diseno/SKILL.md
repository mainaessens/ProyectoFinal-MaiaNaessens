---
name: iterar-diseno
description: Aplica cambios pedidos por el humano sobre una pieza hecha con Claude Design (HTML) y genera una versión nueva (vN+1) sin pisar las anteriores, con lint y render. Es lo que se lanza desde Faro (cliente → Diseños → Pedir cambios) para ir afinando la pieza hasta el resultado esperado.
argument-hint: <cliente> <pieza> <cambios a aplicar>
tools: Read, Write, Edit, Bash, Glob, AskUserQuestion
---

# /iterar-diseno

## Uso

```
/iterar-diseno <cliente> <pieza> <cambios>
```

- `<pieza>`: id de la carpeta en `clientes/<cliente>/diseno/` (ej. `2026-11-20-obra-teatro`). Si
  falta o es ambiguo, listar con `marca.mjs listar <cliente>` y preguntar.
- `<cambios>`: lo que el humano quiere distinto, en sus palabras ("el título más corto", "usá otra
  foto de la obra", "fondo oscuro"). Si el pedido es ambiguo, hacer **una** pregunta concreta antes
  de tocar nada.

## Procedimiento

1. **Crear la versión**: `node herramientas/marca/marca.mjs iterar <cliente> <pieza>` copia la última
   versión a `vN+1.html`. Se edita **solo** la nueva; las anteriores no se tocan.
2. **Aplicar únicamente lo pedido**. No rediseñar lo que el humano no mencionó. Reglas de siempre:
   variables de marca (`var(--c-*)`, `var(--f-*)`), texto sin inventar datos, fotos reales con
   `{{ASSETS}}/fotos/...`, una sola acción (CTA), zonas seguras en historias.
3. **Controlar**: `marca.mjs lint <cliente> <pieza>`; corregir los errores.
4. **Renderizar y mirar**: `marca.mjs render <cliente> <pieza>` y abrir cada PNG con `Read`. Si algo
   quedó mal (texto cortado, foto tapada), corregir en la misma versión nueva y volver a renderizar.
5. **Anotar** en `diseno/<pieza>/notas.md` una línea: `vN: <pedido del humano> → <qué se cambió>`.
6. **Informar** en pocas líneas: qué cambió, resultado del lint, y que la versión nueva ya está en
   **Faro → Diseños** para compararla con la anterior. Preguntar si aprueba o quiere más cambios.
   Si aprueba: `marca.mjs exportar <cliente> <pieza> [vN]` y actualizar el `diseno` del `.plan.json`
   (`version`, `html_fuente`, `archivo_exportado`) si ya existía el plan.

## Reglas

- Nunca pisar ni borrar versiones anteriores.
- Nunca publicar ni marcar un plan como aprobado: la aprobación es del humano.
- Si el pedido choca con el perfil (restricciones, tono) o con la marca, decirlo y proponer una
  alternativa en vez de aplicarlo en silencio.
