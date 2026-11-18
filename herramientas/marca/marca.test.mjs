import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  init, build, nueva, iterar, versiones, listarDisenos, lint, lintHtml, leerMarca, construirCss, marcaPorDefecto,
  piezasDeHtml, encontrarNavegador, exportar, aprobar, archivoDePieza, listarPlantillas, render, MarcaError,
} from './lib/marca.mjs';

const nuevaRaiz = () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'marca-test-'));
  fs.mkdirSync(path.join(raiz, 'clientes', 'demo'), { recursive: true });
  return { raiz };
};

test('init crea el kit y no pisa uno existente', () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const m = leerMarca('demo', ctx);
  assert.equal(m.nombre, 'demo');
  assert.ok(fs.existsSync(path.join(ctx.raiz, 'clientes', 'demo', 'marca', 'marca.css')));
  assert.throws(() => init('demo', ctx), MarcaError);
  assert.throws(() => init('../x', ctx), MarcaError);
});

test('construirCss valida colores y archivos de fuente', () => {
  const m = marcaPorDefecto('x');
  assert.match(construirCss(m), /--c-primario: #1f4fd8/);
  m.tokens.colores.primario = 'rojo';
  assert.throws(() => construirCss(m), /Color inválido/);
  const m2 = marcaPorDefecto('x');
  m2.tokens.fuentes.titulo = { familia: 'Mi Fuente', archivo: '../../x.ttf' };
  assert.throws(() => construirCss(m2), /Archivo de fuente inválido/);
  const m3 = marcaPorDefecto('x');
  m3.tokens.fuentes.titulo = { familia: 'Mi Fuente', archivo: 'mi-fuente.ttf' };
  assert.match(construirCss(m3), /@font-face \{ font-family: "Mi Fuente"; src: url\("fuentes\/mi-fuente\.ttf"\)/);
});

test('nueva e iterar versionan sin pisar nada', () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const { id } = nueva('demo', 'prueba', 'feed-cifra', ctx);
  assert.match(id, /^\d{4}-\d{2}-\d{2}-prueba$/);
  assert.throws(() => nueva('demo', 'prueba', 'feed-cifra', ctx).id && nueva('demo', 'prueba', 'feed-cifra', ctx), /ya existe/);
  assert.throws(() => nueva('demo', 'otra', 'no-existe', ctx), /Plantilla desconocida/);
  const dir = path.join(ctx.raiz, 'clientes', 'demo', 'diseno', id);
  fs.writeFileSync(path.join(dir, 'v1.html'), '<div class="piece f-feed-1x1">v1</div>');
  const r = iterar('demo', id, ctx);
  assert.equal(r.n, 2);
  assert.equal(fs.readFileSync(path.join(dir, 'v1.html'), 'utf8'), '<div class="piece f-feed-1x1">v1</div>');
  assert.equal(versiones('demo', id, ctx).length, 2);
  assert.equal(listarDisenos('demo', ctx)[0].id, id);
  assert.throws(() => versiones('demo', '../x', ctx), MarcaError);
});

test('todas las plantillas base pasan el lint con la marca por defecto', () => {
  const marca = marcaPorDefecto('demo');
  for (const p of listarPlantillas()) {
    const html = fs.readFileSync(new URL(`./base/plantillas/${p}.html`, import.meta.url), 'utf8');
    const errores = lintHtml(html, marca).filter((h) => h.nivel === 'error');
    assert.deepEqual(errores, [], `${p}: ${JSON.stringify(errores)}`);
    assert.ok(piezasDeHtml(html).length >= 1, p);
  }
});

test('lint detecta emojis, exclamaciones, palabras prohibidas, relleno, colores y fuentes', () => {
  const marca = marcaPorDefecto('demo');
  marca.reglas = { ...marca.reglas, sinExclamaciones: true, prohibidas: ['Garantizado'] };
  const html = `<style>.x{color:#ff0000;font-family:Comic Sans MS}</style>
    <section class="piece f-feed-1x1"><p>Oferta 🔥 imperdible!</p><p>Resultado garantizado</p><p>Lorem ipsum</p></section>`;
  const reglas = lintHtml(html, marca).map((h) => `${h.nivel}:${h.regla}`);
  for (const esperado of ['error:emojis', 'error:exclamaciones', 'error:prohibidas', 'error:relleno', 'aviso:colores', 'aviso:fuentes', 'aviso:logo']) {
    assert.ok(reglas.includes(esperado), `falta ${esperado}: ${reglas}`);
  }
  assert.ok(lintHtml('<p>hola</p>', marca).some((h) => h.regla === 'piece' && h.nivel === 'error'));
});

test('lint de una pieza usa la última versión por defecto', () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const { id } = nueva('demo', 'p', 'feed-lista', ctx);
  const r = lint('demo', id, undefined, ctx);
  assert.equal(r.version, 1);
  assert.equal(r.hallazgos.filter((h) => h.nivel === 'error').length, 0);
});

test('piezasDeHtml toma el tamaño de la clase de formato o de data-size', () => {
  const html = '<section class="piece f-story"></section><div class="piece" data-size="800x600"></div><section class="piece f-feed-4x5"></section>';
  assert.deepEqual(piezasDeHtml(html), [{ ancho: 1080, alto: 1920 }, { ancho: 800, alto: 600 }, { ancho: 1080, alto: 1350 }]);
});

test('encontrarNavegador respeta MARCA_NAVEGADOR y devuelve null si no hay', () => {
  assert.equal(encontrarNavegador({ MARCA_NAVEGADOR: 'X' }, (p) => p === 'X'), 'X');
  assert.equal(encontrarNavegador({}, () => false), null);
});

test('exportar exige render previo y copia a assets/exports', () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const { id } = nueva('demo', 'p', 'feed-cifra', ctx);
  assert.throws(() => exportar('demo', id, undefined, ctx), /no está renderizada/);
  const dir = path.join(ctx.raiz, 'clientes', 'demo', 'diseno', id);
  fs.writeFileSync(path.join(dir, 'v1.png'), 'png');
  const [dest] = exportar('demo', id, 1, ctx);
  assert.equal(path.basename(dest), `${id}.png`);
  assert.ok(fs.existsSync(dest));
});

test('aprobar exporta la versión, deja constancia y la muestra en el listado', () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const { id } = nueva('demo', 'p', 'feed-cifra', ctx);
  const dir = path.join(ctx.raiz, 'clientes', 'demo', 'diseno', id);
  assert.throws(() => aprobar('demo', id, 1, ctx), /no está renderizada/);
  fs.writeFileSync(path.join(dir, 'v1.png'), 'png');
  const reg = aprobar('demo', id, 1, { ...ctx, por: 'faro-ui' });
  assert.equal(reg.version, 1);
  assert.equal(reg.por, 'faro-ui');
  assert.deepEqual(reg.archivos, [`assets/exports/${id}.png`]);
  assert.equal(listarDisenos('demo', ctx)[0].aprobada.version, 1);
  assert.throws(() => aprobar('demo', id, 9, ctx), /No existe la versión/);
});

test('archivoDePieza solo sirve vN.html y vN.png dentro de la pieza', () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const { id } = nueva('demo', 'p', 'feed-cifra', ctx);
  assert.ok(archivoDePieza('demo', id, 'v1.html', ctx));
  assert.equal(archivoDePieza('demo', id, '../marca/marca.json', ctx), null);
  assert.equal(archivoDePieza('demo', id, 'v1.png', ctx), null); // no existe todavía
  assert.equal(archivoDePieza('demo', '../x', 'v1.html', ctx), null);
});

// Prueba de punta a punta con el navegador real (se omite si no hay Edge/Chrome).
test('render genera un PNG del tamaño de la pieza', { skip: !encontrarNavegador() }, async () => {
  const ctx = nuevaRaiz();
  init('demo', ctx);
  const { id } = nueva('demo', 'p', 'carrusel', ctx);
  const archivos = await render('demo', id, undefined, { ctx });
  assert.equal(archivos.length, 3);
  for (const a of archivos) {
    const buf = fs.readFileSync(a);
    assert.equal(buf.subarray(1, 4).toString(), 'PNG');
    assert.equal(buf.readUInt32BE(16), 1080); // ancho
    assert.equal(buf.readUInt32BE(20), 1350); // alto
  }
  const dir = path.join(ctx.raiz, 'clientes', 'demo', 'diseno', id);
  assert.ok(!fs.readdirSync(dir).some((f) => f.startsWith('.render')), 'no quedan temporales');
});
