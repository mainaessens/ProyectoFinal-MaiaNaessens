import { useCallback, useEffect, useState } from 'react';
import { api, apiBlob } from './api.js';

// Imagen protegida por el token: se baja con el header y se muestra desde una URL local.
function Img({ token, slug, pieza, archivo, alt }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    let vivo = true;
    apiBlob(token, `/clientes/${slug}/disenos/${pieza}/${archivo}`).then((b) => { if (vivo) { url = URL.createObjectURL(b); setSrc(url); } }).catch(() => {});
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [token, slug, pieza, archivo]);
  return src ? <img className="diseno-img" src={src} alt={alt} /> : <div className="diseno-img vacia muted small">cargando…</div>;
}

function Vista({ token, slug, pieza, version }) {
  if (!version) return null;
  if (!version.pngs.length) {
    return <div className="banner warn">La versión v{version.n} todavía no tiene imagen: pedile al agente que la renderice (<code>marca.mjs render</code>).</div>;
  }
  return (
    <div className="diseno-fila">
      {version.pngs.map((f) => <Img key={f} token={token} slug={slug} pieza={pieza} archivo={f} alt={`${pieza} ${f}`} />)}
    </div>
  );
}

/**
 * Pestaña "Diseños" de un cliente: piezas hechas con Claude Design (código), sus versiones, comparación
 * con la anterior, pedido de cambios (lanza /iterar-diseno en la consola del agente) y aprobación.
 */
export default function Disenos({ token, slug, onPedido }) {
  const [piezas, setPiezas] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState('');
  const [ver, setVer] = useState(null);       // número de versión mostrada (null = la última)
  const [comparar, setComparar] = useState(false);
  const [cambios, setCambios] = useState('');
  const [tema, setTema] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api(token, `/clientes/${slug}/disenos`);
      setPiezas(r); setErr('');
      setSel((s) => (r.some((p) => p.id === s) ? s : r[0]?.id || ''));
    } catch (e) { setErr(e.message); }
  }, [token, slug]);
  useEffect(() => { setPiezas(null); cargar(); }, [cargar]);
  useEffect(() => { setVer(null); setComparar(false); setCambios(''); }, [sel]);

  const nueva = (
    <form className="card row grow" onSubmit={(e) => { e.preventDefault(); if (tema.trim()) { onPedido(slug, 'disenar', `"${tema.trim().replace(/"/g, "'")}"`); setTema(''); } }}>
      <input value={tema} onChange={(e) => setTema(e.target.value)} maxLength={400} placeholder="Diseñar una pieza nueva: tema o número del calendario (ej. 3, o «tips para cuidar el parquet»)" />
      <button className="primary" disabled={!tema.trim()}>Diseñar con el agente</button>
    </form>
  );

  if (err) return <div className="banner bad">{err}</div>;
  if (!piezas) return <p className="muted">Cargando…</p>;
  if (!piezas.length) {
    return (
      <div className="stack">
        <div className="card"><p className="muted">Todavía no hay piezas hechas con Claude Design. Pedí una acá abajo (usa el kit de marca del cliente, controla la marca y deja la imagen lista para revisar) o ejecutá <code>/disenar</code> desde la sección Agente. El motor Canva sigue disponible: pedilo en el tema («con Canva») o definilo en el perfil.</p></div>
        {nueva}
      </div>
    );
  }

  const pieza = piezas.find((p) => p.id === sel) || piezas[0];
  const ultima = pieza.versiones[pieza.versiones.length - 1];
  const actual = pieza.versiones.find((v) => v.n === ver) || ultima;
  const anterior = pieza.versiones.filter((v) => v.n < actual.n).pop();
  const aprobadaN = pieza.aprobada?.version;

  const aprobar = async () => {
    if (!window.confirm(`¿Aprobar v${actual.n} de "${pieza.id}"? Se exporta a assets/exports/ y queda lista para el plan de publicación.`)) return;
    setBusy(true); setErr('');
    try { await api(token, `/clientes/${slug}/disenos/${pieza.id}/aprobar`, { method: 'POST', body: { version: actual.n } }); await cargar(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const pedir = (e) => {
    e.preventDefault();
    const texto = cambios.trim().replace(/[\r\n]+/g, ' ');
    if (!texto) return;
    onPedido(slug, 'iterar-diseno', `${pieza.id} ${texto}`);
    setCambios('');
  };

  return (
    <div className="stack">
      {nueva}
      <div className="diseno-layout">
        <aside className="diseno-lista card">
          {piezas.map((p) => (
            <button key={p.id} className={`diseno-item ${p.id === pieza.id ? 'on' : ''}`} onClick={() => setSel(p.id)}>
              <strong className="clip">{p.id}</strong>
              <span className="muted small">{p.versiones.length} {p.versiones.length === 1 ? 'versión' : 'versiones'}{p.aprobada ? ` · aprobada v${p.aprobada.version}` : ''}</span>
            </button>
          ))}
        </aside>

        <div className="stack">
          <div className="card stack">
            <div className="row between">
              <div className="row">
                {pieza.versiones.map((v) => (
                  <button key={v.n} className={`chip ${v.n === actual.n ? 'on' : ''}`} onClick={() => setVer(v.n)}>
                    v{v.n}{v.n === aprobadaN ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              <div className="row">
                {anterior && <label className="small row"><input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} /> comparar con v{anterior.n}</label>}
                {actual.n === aprobadaN
                  ? <span className="pill ok">Aprobada</span>
                  : <button className="primary" onClick={aprobar} disabled={busy || !actual.pngs.length}>Aprobar v{actual.n}</button>}
              </div>
            </div>
            {comparar && anterior ? (
              <div className="diseno-comparar">
                <div><p className="muted small">v{anterior.n} (anterior)</p><Vista token={token} slug={slug} pieza={pieza.id} version={anterior} /></div>
                <div><p className="muted small">v{actual.n} (nueva)</p><Vista token={token} slug={slug} pieza={pieza.id} version={actual} /></div>
              </div>
            ) : <Vista token={token} slug={slug} pieza={pieza.id} version={actual} />}
          </div>

          <form className="card stack" onSubmit={pedir}>
            <label>Pedir cambios sobre v{actual.n}
              <textarea value={cambios} onChange={(e) => setCambios(e.target.value)} rows={3} maxLength={420}
                placeholder="Ej.: el título más corto, usá otra foto de la obra, fondo oscuro, el CTA más grande…" />
            </label>
            <div className="row end">
              <span className="muted small">El agente crea una versión nueva (v{ultima.n + 1}) sin pisar las anteriores y la vas a ver acá.</span>
              <button className="primary" disabled={!cambios.trim()}>Pedir cambios</button>
              <button type="button" className="ghost" onClick={cargar}>Actualizar</button>
            </div>
          </form>
          {pieza.notas && <details className="card"><summary>Historial de cambios</summary><pre className="notas">{pieza.notas}</pre></details>}
        </div>
      </div>
    </div>
  );
}
