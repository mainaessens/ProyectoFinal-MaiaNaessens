import { useState } from 'react';
import { api } from './api.js';

const fecha = (p) => (p.fecha_programada || '').replace('T', ' ').slice(0, 16) || '—';

function estadoDe(p) {
  if (p.error) return { cls: 'bad', txt: 'JSON inválido' };
  if (p.estado === 'rechazado') return { cls: 'bad', txt: 'Rechazado' };
  if (p.aprobado === true) return { cls: 'ok', txt: 'Aprobado' };
  return { cls: 'warn', txt: 'Pendiente de aprobación' };
}

export default function Planes({ token, slug, planes, onChange }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const decidir = async (archivo, aprobado) => {
    const msg = aprobado
      ? `¿Aprobar "${archivo}"? Habilita la publicación de esta pieza (texto y horario tal como se ve).`
      : `¿Rechazar "${archivo}"?`;
    if (!window.confirm(msg)) return;
    setBusy(archivo); setErr('');
    try {
      await api(token, `/clientes/${slug}/planes/${archivo}/decision`, { method: 'POST', body: { aprobado } });
      await onChange();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  if (!planes.length) return <p className="muted">Este cliente todavía no tiene planes de publicación.</p>;

  return (
    <div className="stack">
      {err && <div className="banner bad">{err}</div>}
      {planes.map((p) => {
        const st = estadoDe(p);
        return (
          <article key={p.archivo} className="card plan">
            <header>
              <div>
                <h3>{p.hook_texto || p.archivo}</h3>
                <p className="muted small">
                  {fecha(p)} · {(p.red || []).join(', ') || 'sin red'} {p.pilar ? `· ${p.pilar}` : ''}
                </p>
              </div>
              <span className={`pill ${st.cls}`}>{st.txt}</span>
            </header>
            {p.caption && (
              <div className="captions">
                {Object.entries(p.caption).map(([red, txt]) => (
                  <details key={red}>
                    <summary>Caption {red}</summary>
                    <p>{txt}</p>
                  </details>
                ))}
              </div>
            )}
            <footer>
              <span className="muted small">
                {p.checklist_marca ? `Checklist de marca: ${p.checklist_marca}` : ''}
                {p.diseno_pendiente ? ' · diseño pendiente' : ''}
              </span>
              <div className="row">
                <button className="ghost danger" disabled={busy === p.archivo || p.estado === 'rechazado'}
                  onClick={() => decidir(p.archivo, false)}>Rechazar</button>
                <button className="primary" disabled={busy === p.archivo || p.aprobado === true || !!p.error}
                  onClick={() => decidir(p.archivo, true)}>Aprobar</button>
              </div>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
