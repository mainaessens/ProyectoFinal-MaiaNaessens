# Test técnico — Fase 2 (PFMGN-28)

**Fecha:** 2026-08-21

## Qué se validó

Que `/nuevo-cliente <nombre> <url-drive>` sea capaz de: leer una carpeta de Drive real,
localizar brief + manual de marca + subcarpetas fotos/videos, extraer datos de marca, y generar
un `perfil.md` enriquecido mostrando qué vino de qué fuente.

## Cómo se hizo

1. Se creó una carpeta de prueba en Drive (`cedite-test-drive/`) con un `brief` y un
   `manual-de-marca` (Google Docs, contenido ficticio) y subcarpetas `fotos/` y `videos/` vacías.
2. Se ejecutó el flujo del skill: `search_files` sobre la carpeta → localizó los 4 elementos
   correctamente (brief, manual-de-marca, fotos/, videos/) sin ambigüedad.
3. Se leyó el contenido de ambos documentos y se generó `clientes/cedite-drive-test/perfil.md`
   citando la fuente de cada dato (brief vs. manual de marca) y marcando explícitamente lo que
   no estaba disponible.

## Resultado

✅ El mecanismo funciona: localiza los archivos por nombre, extrae tono/paleta/restricciones/
pilares sin inventar datos no presentes en el material, y deja claro qué falta completar.

## Pendiente — importante

Esto valida el **mecanismo técnico**, no reemplaza la aceptación real de PFMGN-28
("coordinar con CEDITE, recopilar brief + manual de marca reales"). Esa coordinación es una
gestión externa con el cliente real que el agente no puede ejecutar por sí mismo. Cuando el
brief real de CEDITE esté disponible (historia PFMGN-69), reemplazar esta carpeta de prueba
por la carpeta real y repetir `/nuevo-cliente` para generar el perfil definitivo.
