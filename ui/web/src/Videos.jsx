import { useCallback, useEffect, useState } from 'react';
import { api, apiBlob } from './api.js';

const seg = (n) => (typeof n === 'number' ? `${n.toFixed(1)}s` : '—');
const MAX_ARGS = 480; // los argumentos del agente están acotados
const FORMATOS = [['reel', 'Reel 9:16'], ['historia', 'Historia 9:16'], ['cuadrado', 'Cuadrado 1:1']];
const DURACIONES = [8, 15, 30, 45, 60];

// El mp4 está protegido por el token: se baja con el header y se reproduce desde una URL local.
function Reproductor({ token, slug, archivo }) {
  const [src, setSrc] = useState('');
  const [err, setErr] = useState(false);
  useEffect(() => {
    let url = '';
    let vivo = true;
    setSrc(''); setErr(false);
    apiBlob(token, `/clientes/${slug}/videos/${archivo}`)
      .then((b) => { if (vivo) { url = URL.createObjectURL(b); setSrc(url); } })
      .catch(() => { if (vivo) setErr(true); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [token, slug, archivo]);
  if (err) return <p className="muted small">No se pudo cargar el video.</p>;
  return src ? <video className="video-player" src={src} controls playsInline /> : <p className="muted small">Cargando video…</p>;
}

// Video sin material de base: se describe la idea y el agente lo arma como HTML/CSS (con el kit de marca y, si se quiere, fotos reales).
function SinMaterial({ token, slug, onPedido }) {
  const [idea, setIdea] = useState('');
  const [formato, setFormato] = useState('reel');
  const [duracion, setDuracion] = useState(15);
  const [imgs, setImgs] = useState([]);
  const [sel, setSel] = useState([]);
  useEffect(() => { setSel([]); api(token, '/clientes/' + slug + '/imagenes').then(setImgs).catch(() => setImgs([])); }, [token, slug]);
  const alternar = (f) => setSel((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]));

  const limpio = idea.trim().replace(/[\r\n]+/g, ' ').replace(/"/g, "'");
  const args = '"' + limpio + '" formato=' + formato + ' duracion=' + duracion + (sel.length ? ' imagenes=' + sel.join(',') : '');
  const largo = args.length > MAX_ARGS;
  const enviar = (e) => { e.preventDefault(); if (limpio && !largo) { onPedido(slug, 'crear-video', args); setIdea(''); setSel([]); } };

  return (
    <form className="card stack" onSubmit={enviar}>
      <div>
        <h3>Video sin material de base</h3>
        <p className="muted small">Describí la idea y el agente arma el video con HTML y CSS usando el kit de marca del cliente. Podés sumar sus fotos reales. Antes de exportar vas a ver el plan escena por escena.</p>
      </div>
      <textarea rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={400}
        placeholder="Ej.: 15 s para mostrar los 3 pasos del servicio, gancho con la pregunta «¿tu piso ya no brilla?», cierre con el teléfono y el logo" />
      <div className="row">
        <label>Formato
          <select value={formato} onChange={(e) => setFormato(e.target.value)}>{FORMATOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
        <label>Duración
          <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>{DURACIONES.map((d) => <option key={d} value={d}>{d} s</option>)}</select>
        </label>
      </div>
      {imgs.length > 0 && (
        <details>
          <summary className="small">Imágenes del cliente a usar {sel.length ? '(' + sel.length + ')' : '(el agente elige si no marcás ninguna)'}</summary>
          <div className="imagenes">
            {imgs.map((f) => (
              <label key={f} className="opcion small"><input type="checkbox" checked={sel.includes(f)} onChange={() => alternar(f)} />{f}</label>
            ))}
          </div>
        </details>
      )}
      <div className="row end">
        <span className="muted small">{largo ? 'Demasiado texto: acortá la idea o marcá menos imágenes.' : 'Solo se usan fotos y logos del cliente; nada se publica.'}</span>
        <button className="primary" disabled={!limpio || largo}>Crear con el agente</button>
      </div>
    </form>
  );
}

/**
 * Pestaña "Videos" de un cliente: videos editados con Moviola (/editar-video), sus versiones, el plan escena por
 * escena, el video terminado y el pedido de cambios. Editar y exportar lo hace el agente; acá se revisa y se pide.
 */
export default function Videos({ token, slug, onPedido }) {
  const [videos, setVideos] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState('');
  const [ver, setVer] = useState(null);
  const [notas, setNotas] = useState({});

  const cargar = useCallback(async () => {
    try {
      const r = await api(token, `/clientes/${slug}/videos`);
      setVideos(r); setErr('');
      setSel((s) => (r.some((v) => v.id === s) ? s : r[0]?.id || ''));
    } catch (e) { setErr(e.message); }
  }, [token, slug]);
  useEffect(() => { setVideos(null); cargar(); }, [cargar]);
  useEffect(() => { setVer(null); setNotas({}); }, [sel]);

  const nuevo = (
    <div className="card row between">
      <p className="muted small grow-1">¿Tenés un video filmado? Dejá el bruto en <code>assets/videos/</code> del cliente y editalo con el agente.</p>
      <button className="ghost" onClick={() => onPedido(slug, 'editar-video', '')}>Editar un bruto</button>
    </div>
  );

  if (err) return <div className="banner bad">{err}</div>;
  if (!videos) return <p className="muted">Cargando…</p>;
  if (!videos.length) {
    return (
      <div className="stack">
        <div className="card"><p className="muted">Todavía no hay videos editados. <code>/editar-video</code> corta silencios, subtitula y agrega títulos con la marca del cliente; el plan escena por escena y el video terminado aparecen acá para revisarlos.</p></div>
        <SinMaterial token={token} slug={slug} onPedido={onPedido} />
        {nuevo}
      </div>
    );
  }

  const video = videos.find((v) => v.id === sel) || videos[0];
  const ultima = video.versiones[video.versiones.length - 1];
  const actual = video.versiones.find((v) => v.n === ver) || ultima;
  const conNotas = Object.entries(notas).filter(([, t]) => t.trim());
  const texto = conNotas.map(([n, t]) => `escena ${n}: ${t.trim().replace(/[\r\n]+/g, ' ')}`).join('; ');
  const args = `${video.id} v${actual.n} — ${texto}`;
  const skillEdicion = actual.tipo === 'html' ? 'crear-video' : 'editar-video';

  const pedir = (e) => {
    e.preventDefault();
    if (!conNotas.length || args.length > MAX_ARGS) return;
    onPedido(slug, skillEdicion, args);
    setNotas({});
  };
  const generarPrevia = () => onPedido(slug, 'crear-video', video.id + ' v' + actual.n + ' — generá la vista previa (render draft) en assets/edicion');
  const exportar = () => {
    if (!window.confirm(`¿Aprobar todas las escenas de v${actual.n} de "${video.id}" y exportar el video?`)) return;
    onPedido(slug, skillEdicion, `${video.id} v${actual.n} — aprobado por el operador: marcar aprobado_total y exportar`);
  };

  return (
    <div className="stack">
      <SinMaterial token={token} slug={slug} onPedido={onPedido} />
      {nuevo}
      <div className="diseno-layout">
        <aside className="diseno-lista card">
          {videos.map((v) => {
            const u = v.versiones[v.versiones.length - 1];
            return (
              <button key={v.id} className={`diseno-item ${v.id === video.id ? 'on' : ''}`} onClick={() => setSel(v.id)}>
                <strong className="clip">{v.id}</strong>
                <span className="muted small">{v.versiones.length} {v.versiones.length === 1 ? 'versión' : 'versiones'}{u.mp4 ? ' · exportado' : ''}</span>
              </button>
            );
          })}
        </aside>

        <div className="stack">
          <div className="card stack">
            <div className="row between">
              <div className="row">
                {video.versiones.map((v) => (
                  <button key={v.n} className={`chip ${v.n === actual.n ? 'on' : ''}`} onClick={() => setVer(v.n)}>v{v.n}{v.mp4 ? ' ✓' : ''}</button>
                ))}
              </div>
              <div className="row">
                {actual.tipo === 'html' && !actual.mp4 && <button className="ghost" onClick={generarPrevia}>{actual.preview ? 'Actualizar vista previa' : 'Generar vista previa'}</button>}
                {actual.tipo === 'html' && <span className="pill">HTML/CSS</span>}
                {actual.formato && <span className="pill">{actual.formato}</span>}
                {actual.mp4 ? <span className="pill ok">Exportado</span>
                  : actual.aprobadoTotal ? <span className="pill ok">Aprobado</span>
                  : <button className="primary" onClick={exportar} disabled={!actual.escenas.length}>Aprobar todo y exportar</button>}
              </div>
            </div>
            {actual.mp4 || actual.preview ? (
              <>
                {!actual.mp4 && <p className="muted small">Vista previa: borrador de baja calidad para revisar ritmo, textos e imágenes. El video final se exporta al aprobar.</p>}
                <Reproductor key={actual.mp4 || actual.preview} token={token} slug={slug} archivo={actual.mp4 || actual.preview} />
              </>
            ) : (
              <p className="muted small">Todavía no hay vista previa de esta versión. Generala con el botón de abajo o revisá el plan escena por escena.</p>
            )}
          </div>

          {actual.brief && <p className="card muted small">Idea: {actual.brief}</p>}

          {actual.escenas.length > 0 && (
            <form className="card" onSubmit={pedir}>
              <h3>Plan escena por escena{actual.subtitulos ? ' · con subtítulos' : ''}</h3>
              {actual.escenas.map((e) => (
                <div key={e.n} className="escena">
                  <span className="escena-n">{e.n}</span>
                  <div>
                    <div className="row between">
                      <strong>{e.titulo || '(sin título)'}</strong>
                      <span className={`pill ${e.estado === 'aprobada' ? 'ok' : ''}`}>{e.estado}</span>
                    </div>
                    <p className="muted small">{actual.tipo === 'html' ? 'Duración ' + (e.duracion ?? '—') + ' s' : 'Bruto ' + seg(e.inicio) + ' → ' + seg(e.fin)}{e.sonido ? ` · sonido: ${e.sonido}` : ''}</p>
                    {e.descripcion && <p>{e.descripcion}</p>}
                    {e.notas && <p className="muted small">Nota previa: {e.notas}</p>}
                    <textarea rows={2} maxLength={200} value={notas[e.n] || ''} onChange={(ev) => setNotas((x) => ({ ...x, [e.n]: ev.target.value }))}
                      placeholder="Notas para esta escena (qué cambiar y cómo)…" />
                  </div>
                </div>
              ))}
              <div className="row end">
                <span className="muted small">{args.length > MAX_ARGS ? 'Demasiado texto: acortá las notas.' : `El agente crea v${ultima.n + 1} sin pisar las anteriores.`}</span>
                <button className="primary" disabled={!conNotas.length || args.length > MAX_ARGS}>Enviar notas</button>
                <button type="button" className="ghost" onClick={cargar}>Actualizar</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
