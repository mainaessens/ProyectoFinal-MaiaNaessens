---
name: disenar
description: Diseña la pieza gráfica de un post, carrusel o historia de un cliente. Primera opción, Claude Design con código; HTML con el kit de marca del cliente, control de marca (lint), render a PNG y versiones que se iteran desde Postagent (pestaña Diseños). Alternativa, Canva con las plantillas maestras del cliente. Nunca publica; deja la pieza lista para que el humano la revise, pida cambios o la apruebe.
argument-hint: <cliente> <#|slug|"tema"> [canva]
tools: Read, Write, Edit, Bash, Glob, AskUserQuestion, mcp__canva__*, mcp__gworkspace__*
---

# /disenar

Produce una pieza gráfica a partir de una fila del calendario (con su ficha desarrollada) o de un
tema libre. Es el paso de diseño que usa `/crear-post`, y también se puede correr solo.

## Uso

```
/disenar <cliente> <#|slug|"tema"> [canva]
```

## Elegir el motor de diseño

Orden de decisión (el primero que aplique):

1. **Lo que pida el usuario** en este pedido ("con Canva", "en Claude Design").
2. **`Motor de diseño`** del `perfil.md` del cliente (`claude-design` o `canva`).
3. **Por defecto: Claude Design (código).**

Canva sigue disponible y funciona como antes (ver "Motor Canva"). Declarar siempre al presentar la
pieza qué motor se usó y por qué.

## Motor Claude Design (código)

Herramienta: `node herramientas/marca/marca.mjs <comando> <cliente> ...` (ver
`docs/diseno-claude-design.md`). Todo corre en la computadora; los renders usan Edge o Chrome.

1. **Resolver la pieza**: leer su ficha en `calendario-editorial.md` (`## Desarrollo de piezas`) o
   el tema libre, y el `perfil.md` (tono, restricciones, paleta, tipografías, reglas de estilo).
   Para el material, seguir la prioridad de `CLAUDE.md`: foto real del cliente → solo texto/diseño
   → imagen IA (excepcional, con las tres condiciones y declarada).

2. **Asegurar el kit de marca** (`clientes/<cliente>/marca/`):
   - Si falta: `marca.mjs init <cliente>`; completar `marca.json` con lo que dice el perfil y el
     manual (colores en hex, familias tipográficas, nombre del logo) y copiar los logos y fuentes
     de `assets/identidad/` a `marca/logo/` y `marca/fuentes/`. Las **restricciones del perfil**
     pasan a `reglas.prohibidas`. Lo que no esté en el material del cliente no se inventa: se
     marca como supuesto en `marca.json` (`"nota"`) y se avisa.
   - Si el logo es un archivo, usarlo en la pieza (`<span class="logo"><img src="{{MARCA}}/logo/..."></span>`);
     si no hay, queda el nombre en texto (`wordmark`).
   - `marca.mjs build <cliente>` regenera `marca.css`.

3. **Crear la pieza**: `marca.mjs plantillas` y elegir la más parecida al formato y la función
   (feed-cifra, feed-foto, feed-lista, historia, carrusel); `marca.mjs nueva <cliente> <slug> <plantilla>`
   crea `diseno/<fecha>-<slug>/v1.html`.

4. **Escribir la pieza** editando `v1.html`:
   - Texto exacto de la ficha (hook, titular, CTA único). Una idea por pieza o por placa.
   - Solo variables de la marca (`var(--c-*)`, `var(--f-*)`): nada de colores ni fuentes sueltos.
   - Fotos reales con `{{ASSETS}}/fotos/...` (verificar que el archivo existe con `Glob`).
   - Historias: respetar las zonas seguras; carruseles: una `.piece` por placa.
   - Se pueden agregar estilos propios en `<style>` si los valores salen de las variables de marca.

5. **Controlar y mirar**:
   - `marca.mjs lint <cliente> <pieza>`: corregir todos los **errores**; revisar los avisos.
   - `marca.mjs render <cliente> <pieza>` y **abrir cada PNG con `Read`**: buscar texto cortado,
     titulares de más de 3 líneas, falta de aire, foto tapada, logo chico. Corregir y volver a
     renderizar hasta que quede limpio (cada cambio es una versión nueva: ver `/iterar-diseno`).

6. **Presentar** la pieza: ruta del PNG, motor, plantilla, qué foto se usó y de dónde salió, y el
   resultado del lint. Avisar que se puede ver y pedir cambios en **Postagent → cliente → Diseños**.
   Pedir decisión con `AskUserQuestion`: aprobar / pedir cambios / rechazar. Si pide cambios:
   `/iterar-diseno` (versión nueva, sin pisar la anterior).

7. **Si aprueba**: `marca.mjs exportar <cliente> <pieza> [vN]` copia los PNG a `assets/exports/`.
   En el `.plan.json` va `diseno: { "motor": "claude-design", "plantilla": "<base>", "html_fuente":
   "diseno/<pieza>/vN.html", "version": N, "archivo_exportado": "assets/exports/<pieza>.png" }`.

## Motor Canva

El flujo de siempre: plantilla maestra del cliente (post, carrusel, historia) → foto o texto →
revisión contra el perfil → exportar con `get-export-formats` + `export-design` a
`assets/exports/`. Nunca usar brand kits de otros clientes. Si Canva no está disponible o el
cliente no tiene plantillas: modo plan (`diseno_pendiente: true`) o cambiar a Claude Design si el
usuario lo acepta. En el `.plan.json`: `diseno.motor: "canva"` con `design_id` y `plantilla_canva`.

## Reglas

- Nunca publicar ni programar: solo producir y presentar.
- No saltarse el lint ni mirar el render antes de presentar.
- Nunca pisar una versión: cada cambio es `vN+1`.
- No copiar material de la marca de otro cliente (logos, textos, plantillas) a este.
- Imagen IA solo bajo las tres condiciones de `CLAUDE.md`, siempre declarada.
