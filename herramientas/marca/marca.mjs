#!/usr/bin/env node
// CLI del motor de marca y diseño. Uso: node herramientas/marca/marca.mjs <comando> <cliente> [...]
//   init <cliente>                          crea clientes/<c>/marca/ (marca.json + marca.css)
//   build <cliente>                         regenera marca.css desde marca.json
//   plantillas                              lista las plantillas base
//   nueva <cliente> <slug> <plantilla>      crea diseno/<fecha>-<slug>/v1.html
//   iterar <cliente> <pieza>                copia la última versión a vN+1 para aplicar cambios
//   listar <cliente>                        piezas y versiones
//   lint <cliente> <pieza> [vN]             control de marca (código de salida 1 si hay errores)
//   render <cliente> <pieza> [vN] [--escala 2]   PNG junto al HTML (Edge/Chrome headless)
//   exportar <cliente> <pieza> [vN]         copia los PNG a assets/exports/
import { init, build, listarPlantillas, nueva, iterar, listarDisenos, lint, render, exportar, MarcaError } from './lib/marca.mjs';

const [cmd, cliente, ...resto] = process.argv.slice(2);
const flag = (nombre) => { const i = resto.indexOf(nombre); if (i < 0) return null; const [, v] = resto.splice(i, 2); return v; };
const ver = (s) => (s ? Number(String(s).replace(/^v/i, '')) : undefined);

try {
  switch (cmd) {
    case 'init': console.log(`Kit de marca creado: ${init(cliente)}\nCompletá marca.json (colores, fuentes, logo, reglas) y ejecutá build.`); break;
    case 'build': console.log(`CSS de la marca: ${build(cliente)}`); break;
    case 'plantillas': console.log(listarPlantillas().join('\n')); break;
    case 'nueva': { const [slug, plantilla] = resto; const r = nueva(cliente, slug, plantilla); console.log(`Pieza ${r.id}\nEditá: ${r.archivo}`); break; }
    case 'iterar': { const r = iterar(cliente, resto[0]); console.log(`Versión v${r.n} (copia de ${r.desde})\nEditá: ${r.archivo}`); break; }
    case 'listar': console.log(JSON.stringify(listarDisenos(cliente), null, 2)); break;
    case 'lint': {
      const r = lint(cliente, resto[0], ver(resto[1]));
      for (const h of r.hallazgos) console.log(`[${h.nivel.toUpperCase()}] ${h.regla}: ${h.mensaje}`);
      const errores = r.hallazgos.filter((h) => h.nivel === 'error').length;
      console.log(`v${r.version}: ${errores} errores, ${r.hallazgos.length - errores} avisos`);
      process.exitCode = errores ? 1 : 0;
      break;
    }
    case 'render': {
      const escala = Number(flag('--escala')) || 1;
      const archivos = await render(cliente, resto[0], ver(resto[1]), { escala });
      console.log(archivos.join('\n'));
      break;
    }
    case 'exportar': console.log(exportar(cliente, resto[0], ver(resto[1])).join('\n')); break;
    default:
      console.error('Comandos: init, build, plantillas, nueva, iterar, listar, lint, render, exportar. Ver el encabezado de marca.mjs.');
      process.exitCode = 2;
  }
} catch (e) {
  console.error(e instanceof MarcaError ? `Error: ${e.message}` : e);
  process.exitCode = 1;
}
